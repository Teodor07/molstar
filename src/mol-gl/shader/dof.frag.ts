/**
 * Copyright (c) 2024 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Ludovic Autin <autin@scripps.edu>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

export const dof_frag = `
precision highp float;
precision highp int;
precision highp sampler2D;

#include common

uniform sampler2D tColor;
uniform sampler2D tDepthOpaque;
uniform sampler2D tDepthTransparent;

uniform vec2 uTexSize;
uniform vec4 uBounds;

uniform float uBlurSpread;
uniform float uInFocus;
uniform float uPPM;

uniform float uNear; // Near plane
uniform float uFar;  // Far plane

uniform mat4 uInvProjection; // Inverse projection
uniform mat4 uProjection; // Projection

uniform int uMode; // 0-planar, 1-spherical
uniform vec3 uCenter; // Center of focus sphere in view space

float getViewZ(const in float depth) {
    #if dOrthographic == 1
        return orthographicDepthToViewZ(depth, uNear, uFar);
    #else
        return perspectiveDepthToViewZ(depth, uNear, uFar);
    #endif
}

float getDepthOpaque(const in vec2 coords) {
    #ifdef depthTextureSupport
        return texture(tDepthOpaque, coords).r;
    #else
        return unpackRGBAToDepth(texture(tDepthOpaque, coords));
    #endif
}

float getDepthTransparent(const in vec2 coords) {
    return unpackRGBAToDepth(texture(tDepthTransparent, coords));
}

bool isBackground(const in float depth) {
    return depth == 1.0;
}

float getDepth(const in vec2 coords) {
    return min(getDepthOpaque(coords), getDepthTransparent(coords));
}

float getCOC(vec2 uv) {
    float depth = getDepth(uv);
    float viewDist = getViewZ(depth);
    vec3 aposition = screenSpaceToViewSpace(vec3(uv.xy, depth), uInvProjection);
    float focusDist = length(aposition - uCenter);
    float coc = 0.0; // Circle of Confusion
    if (uMode == 0) { // Planar Depth of Field
        coc = (abs(viewDist) - uInFocus) / uPPM; // Focus distance, focus range
    } else if (uMode == 1) { // Spherical Depth of Field
        coc = focusDist / uPPM;
    }
    coc = clamp(coc, -1.0, 1.0);
    return coc;
}

// Optimized Gaussian blur for better quality and performance
vec3 getBlurredImage(vec2 coords) {
    vec4 blurColor = vec4(0);
    vec2 texelSize = vec2(1.0 / uTexSize.x, 1.0 / uTexSize.y);
    float count = 0.0;
    float kernel[5];
    kernel[0] = 0.204164;
    kernel[1] = 0.304005;
    kernel[2] = 0.393365;
    kernel[3] = 0.304005;
    kernel[4] = 0.204164;

    for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize * uBlurSpread;
            vec2 uvPixel = coords.xy + offset;
            float coc = getCOC(uvPixel);
            coc = smoothstep(0.0, 1.0, abs(coc));
            blurColor.rgb += texture(tColor, uvPixel).rgb * coc * kernel[x + 2] * kernel[y + 2];
            count += coc * kernel[x + 2] * kernel[y + 2];
        }
    }
    blurColor /= count;
    return blurColor.rgb;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uTexSize;
    vec4 color = texture(tColor, uv);
    float depth = getDepth(uv);

    float viewDist = getViewZ(depth);
    vec3 aposition = screenSpaceToViewSpace(vec3(uv.xy, depth), uInvProjection);
    float focusDist = length(aposition - uCenter);
    vec3 blurColor = getBlurredImage(uv);

    float coc = getCOC(uv); // Circle of Confusion

    color.rgb = mix(color.rgb, blurColor, smoothstep(0.0, 1.0, abs(coc))); // Smooth blending based on CoC
    gl_FragColor = color;
}
`;
