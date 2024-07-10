/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Ludovic Autin <ludovic.autin@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

export const shadows_frag = `
precision highp float;
precision highp int;
precision highp sampler2D;

#include common

uniform sampler2D tDepth;
uniform vec2 uTexSize;
uniform vec4 uBounds;

uniform float uNear;
uniform float uFar;

#if dLightCount != 0
    uniform vec3 uLightDirection[dLightCount];
    uniform vec3 uLightColor[dLightCount];
#endif


uniform mat4 uProjection;
uniform mat4 uInvProjection;
uniform float uMaxDistance;
uniform float uTolerance;
uniform float uBias;
uniform float uSamplingPattern;


bool isBackground(const in float depth) {
    return depth == 1.0;
}

bool outsideBounds(const in vec2 p) {
    return p.x < uBounds.x || p.y < uBounds.y || p.x > uBounds.z || p.y > uBounds.w;
}

float getViewZ(const in float depth) {
    #if dOrthographic == 1
        return orthographicDepthToViewZ(depth, uNear, uFar);
    #else
        return perspectiveDepthToViewZ(depth, uNear, uFar);
    #endif
}

float getDepth(const in vec2 coords) {
    #ifdef depthTextureSupport
        return texture2D(tDepth, coords).r;
    #else
        return unpackRGBAToDepth(texture2D(tDepth, coords));
    #endif
}

float screenFade(const in vec2 coords) {
    vec2 c = (coords - uBounds.xy) / (uBounds.zw - uBounds.xy);
    vec2 fade = max(12.0 * abs(c - 0.5) - 5.0, vec2(0.0));
    return saturate(1.0 - dot(fade, fade));
}

float random(const in vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 getRayStep(const in vec3 rayDir, const in float stepLength, const in int stepIndex) {
    if (uSamplingPattern == 1.0) { // Poisson Disk
        float angle = float(stepIndex) * 2.39996323; // 2.39996323 = golden angle
        float radius = sqrt(float(stepIndex) / float(dSteps));
        vec2 offset = vec2(cos(angle), sin(angle)) * radius * stepLength * 9.86; // Increased radius scaling factor
        return rayDir * stepLength + vec3(offset, 0.0) * 0.2; // Increased offset scaling factor
    } else if (uSamplingPattern == 2.0) { // Jittered
        vec3 jitter = vec3(random(vec2(float(stepIndex), 0.0)), random(vec2(float(stepIndex), 1.0)), 0.0) - 0.5;
        return rayDir * stepLength + jitter * stepLength * 0.3; // Increased jitter scaling factor
    } else { // Uniform
        return rayDir * stepLength;
    }
}

// based on https://panoskarabelas.com/posts/screen_space_shadows/
float screenSpaceShadow(const in vec3 position, const in vec3 lightDirection, const in float stepLength) {
    // Ray position and direction (in view-space)
    vec3 rayPos = position;
    vec3 rayDir = -lightDirection;
    //vec3 rayStep = rayDir * stepLength;

    // Ray march towards the light
    float occlusion = 0.0;
    vec4 rayCoords = vec4(0.0);
    for (int i = 0; i < dSteps; ++i) {
        // Step the ray
        vec3 rayStep = getRayStep(rayDir, stepLength, i);
        rayPos += rayStep;

        rayCoords = uProjection * vec4(rayPos, 1.0);
        rayCoords.xyz = (rayCoords.xyz / rayCoords.w) * 0.5 + 0.5;

        if (outsideBounds(rayCoords.xy))
            return 1.0;

        // Compute the difference between the ray's and the camera's depth
        float depth = getDepth(rayCoords.xy);
        float viewZ = getViewZ(depth);
        float zDelta = rayPos.z - viewZ;

        if (zDelta < uTolerance) {
            occlusion = 1.0;

            // Fade out as we approach the edges of the screen
            occlusion *= screenFade(rayCoords.xy);

            break;
        }
    }

    return 1.0 - (uBias * occlusion);
}

void main(void) {
    vec2 invTexSize = 1.0 / uTexSize;
    vec2 selfCoords = gl_FragCoord.xy * invTexSize;

    float selfDepth = getDepth(selfCoords);

    if (isBackground(selfDepth)) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec3 selfViewPos = screenSpaceToViewSpace(vec3(selfCoords, selfDepth), uInvProjection);
    float stepLength = uMaxDistance / float(dSteps);

    float o = 1.0;
    #if dLightCount != 0
        float sh[dLightCount];
        #pragma unroll_loop_start
        for (int i = 0; i < dLightCount; ++i) {
            sh[i] = screenSpaceShadow(selfViewPos, uLightDirection[i], stepLength);
            o = min(o, sh[i]);
        }
        #pragma unroll_loop_end
    #endif

    gl_FragColor = vec4(o);
}
`;