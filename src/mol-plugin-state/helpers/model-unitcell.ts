/**
 * Copyright (c) 2019-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Model, Symmetry } from '../../mol-model/structure';
import { ShapeRepresentation } from '../../mol-repr/shape/representation';
import { Shape } from '../../mol-model/shape';
import { ColorNames } from '../../mol-util/color/names';
import { RuntimeContext } from '../../mol-task';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { Mesh } from '../../mol-geo/geometry/mesh/mesh';
import { MeshBuilder } from '../../mol-geo/geometry/mesh/mesh-builder';
import { BoxCage } from '../../mol-geo/primitive/box';
import { Mat4, Vec3 } from '../../mol-math/linear-algebra';
import { transformCage, cloneCage } from '../../mol-geo/primitive/cage';
import { radToDeg } from '../../mol-math/misc';
import { ModelSymmetry } from '../../mol-model-formats/structure/property/symmetry';
import { Sphere3D } from '../../mol-math/geometry';

const translate05 = Mat4.fromTranslation(Mat4(), Vec3.create(0.5, 0.5, 0.5))
const unitCage = transformCage(cloneCage(BoxCage()), translate05)

const tmpRef = Vec3()
const tmpTranslate = Mat4()

interface UnitcellData {
    symmetry: Symmetry
    ref: Vec3
}

export const UnitcellParams = {
    ...Mesh.Params,
    cellColor: PD.Color(ColorNames.orange),
    cellScale: PD.Numeric(2, { min: 0.1, max: 5, step: 0.1 })
}
export type UnitcellParams = typeof UnitcellParams
export type UnitcellProps = PD.Values<UnitcellParams>

function getUnitcellMesh(data: UnitcellData, props: UnitcellProps, mesh?: Mesh) {
    const state = MeshBuilder.createState(256, 128, mesh)

    const { fromFractional } = data.symmetry.spacegroup.cell

    Vec3.floor(tmpRef, data.ref)
    Mat4.fromTranslation(tmpTranslate, tmpRef)
    const cellCage = transformCage(cloneCage(unitCage), tmpTranslate)

    const radius = (Math.cbrt(data.symmetry.spacegroup.cell.volume) / 300) * props.cellScale
    state.currentGroup = 1
    MeshBuilder.addCage(state, fromFractional, cellCage, radius, 2, 20)

    const cpA = Vec3.create(0, 0, 0)
    Vec3.transformMat4(cpA, Vec3.add(cpA, cpA, tmpRef), fromFractional)
    const cpB = Vec3.create(1, 1, 1)
    Vec3.transformMat4(cpB, Vec3.add(cpB, cpB, tmpRef), fromFractional)
    const cpC = Vec3.create(1, 0, 0)
    Vec3.transformMat4(cpC, Vec3.add(cpC, cpC, tmpRef), fromFractional)
    const cpD = Vec3.create(0, 1, 1)
    Vec3.transformMat4(cpD, Vec3.add(cpD, cpD, tmpRef), fromFractional)

    const center = Vec3()
    Vec3.add(center, cpA, cpB)
    Vec3.scale(center, center, 0.5)
    const d = Math.max(Vec3.distance(cpA, cpB), Vec3.distance(cpC, cpD))
    const sphere = Sphere3D.create(center, d / 2 + radius)

    const m = MeshBuilder.getMesh(state)
    m.setBoundingSphere(sphere)
    return m
}

export async function getUnitcellRepresentation(ctx: RuntimeContext, model: Model, params: UnitcellProps, prev?: ShapeRepresentation<UnitcellData, Mesh, Mesh.Params>) {
    const repr = prev || ShapeRepresentation(getUnitcellShape, Mesh.Utils);
    const symmetry = ModelSymmetry.Provider.get(model)
    if (symmetry) {
        const data = {
            symmetry,
            ref: Vec3.transformMat4(Vec3(), Model.getCenter(model), symmetry.spacegroup.cell.toFractional)
        }
        await repr.createOrUpdate(params, data).runInContext(ctx);
    }
    return repr;
}

function getUnitcellLabel(data: UnitcellData) {
    const { cell, name, num } = data.symmetry.spacegroup
    const { size, anglesInRadians } = cell
    const a = size[0].toFixed(2)
    const b = size[1].toFixed(2)
    const c = size[2].toFixed(2)
    const alpha = radToDeg(anglesInRadians[0]).toFixed(2)
    const beta = radToDeg(anglesInRadians[1]).toFixed(2)
    const gamma = radToDeg(anglesInRadians[2]).toFixed(2)
    const label: string[] = []
    // name
    label.push(`${name} #${num}`)
    // sizes
    label.push(`${a}\u00D7${b}\u00D7${c} \u212B`)
    // angles
    label.push(`\u03b1=${alpha}\u00B0 \u03b2=${beta}\u00B0 \u03b3=${gamma}\u00B0`)
    return label.join(' | ')
}

function getUnitcellShape(ctx: RuntimeContext, data: UnitcellData, props: UnitcellProps, shape?: Shape<Mesh>) {
    const geo = getUnitcellMesh(data, props, shape && shape.geometry);
    const label = getUnitcellLabel(data)
    return Shape.create('Unitcell', data, geo, () => props.cellColor, () => 1, () => label)
}