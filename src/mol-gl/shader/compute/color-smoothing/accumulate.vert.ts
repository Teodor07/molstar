/**
 * Copyright (c) 2021-2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

export const accumulate_vert = `
precision highp float;

#include common
#include read_from_texture

uniform int uGroupCount;

attribute float aSample;
#define SampleID int(aSample)

attribute mat4 aTransform;
attribute float aInstance;

uniform vec2 uGeoTexDim;
uniform sampler2D tPosition;
uniform sampler2D tGroup;

uniform vec2 uColorTexDim;
uniform sampler2D tColor;

varying vec3 vPosition;
varying vec4 vColor;

uniform vec3 uBboxSize;
uniform vec3 uBboxMin;
uniform float uResolution;

uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform vec3 uViewPosition;

void main() {
    vec3 position = readFromTexture(tPosition, SampleID, uGeoTexDim).xyz;
    float group = unpackRGBToInt(readFromTexture(tGroup, SampleID, uGeoTexDim).rgb);

    position = (aTransform * vec4(position, 1.0)).xyz;
    gl_PointSize = 7.0;
    vPosition = (position - uBboxMin) / uResolution;
    gl_Position = vec4(((position - uBboxMin) / uBboxSize) * 2.0 - 1.0, 1.0);

    // Fetch or calculate the normal vector
    vec3 normal = normalize(position); // Replace with actual normal if available

    // Lighting calculations
    vec3 lightDir = normalize(uLightPosition - position);
    vec3 viewDir = normalize(uViewPosition - position);
    vec3 reflectDir = reflect(-lightDir, normal);

    // Ambient
    vec3 ambient = 0.1 * uLightColor;

    // Diffuse
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * uLightColor;

    // Specular
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    vec3 specular = spec * uLightColor;

    vec3 lighting = ambient + diffuse + specular;
    vColor = vec4(lighting, 1.0);

    #if defined(dColorType_group)
        vColor *= readFromTexture(tColor, group, uColorTexDim);
    #elif defined(dColorType_groupInstance)
        vColor *= readFromTexture(tColor, aInstance * float(uGroupCount) + group, uColorTexDim);
    #endif
}
`;
