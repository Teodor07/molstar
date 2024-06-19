/**
 * Slightly adapted from https://github.com/mrdoob/three.js
 * MIT License Copyright (c) 2010-2020 three.js authors
 *
 * WebGL port of Subpixel Morphological Antialiasing (SMAA) v2.8
 * Preset: SMAA 1x Medium (with color edge detection)
 * https://github.com/iryoku/smaa/releases/tag/v2.8
 */

export const edges_frag = `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D tColor;
uniform vec2 uTexSizeInv;

varying vec2 vUv;
varying vec4 vOffset[3];

// Function to calculate luminance of a color
float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

vec4 SMAAColorEdgeDetectionPS(vec2 texcoord, vec4 offset[3], sampler2D colorTex) {
    vec2 threshold = vec2(dEdgeThreshold, dEdgeThreshold);

    // Calculate color and luminance deltas:
    vec4 delta;
    vec3 C = texture2D(colorTex, texcoord).rgb;
    float L = luminance(C);

    vec3 Cleft = texture2D(colorTex, offset[0].xy).rgb;
    float Lleft = luminance(Cleft);
    vec3 t = abs(C - Cleft);
    float lumaDelta = abs(L - Lleft);
    delta.x = max(max(t.r, t.g), t.b) + lumaDelta;

    vec3 Ctop = texture2D(colorTex, offset[0].zw).rgb;
    float Ltop = luminance(Ctop);
    t = abs(C - Ctop);
    lumaDelta = abs(L - Ltop);
    delta.y = max(max(t.r, t.g), t.b) + lumaDelta;

    // We do the usual threshold:
    vec2 edges = step(threshold, delta.xy);

    // Then discard if there is no edge:
    if (dot(edges, vec2(1.0, 1.0)) == 0.0)
        discard;

    // Calculate right and bottom deltas:
    vec3 Cright = texture2D(colorTex, offset[1].xy).rgb;
    float Lright = luminance(Cright);
    t = abs(C - Cright);
    lumaDelta = abs(L - Lright);
    delta.z = max(max(t.r, t.g), t.b) + lumaDelta;

    vec3 Cbottom = texture2D(colorTex, offset[1].zw).rgb;
    float Lbottom = luminance(Cbottom);
    t = abs(C - Cbottom);
    lumaDelta = abs(L - Lbottom);
    delta.w = max(max(t.r, t.g), t.b) + lumaDelta;

    // Calculate the maximum delta in the direct neighborhood:
    float maxDelta = max(max(max(delta.x, delta.y), delta.z), delta.w);

    // Calculate left-left and top-top deltas:
    vec3 Cleftleft = texture2D(colorTex, offset[2].xy).rgb;
    float Lleftleft = luminance(Cleftleft);
    t = abs(C - Cleftleft);
    lumaDelta = abs(L - Lleftleft);
    delta.z = max(max(t.r, t.g), t.b) + lumaDelta;

    vec3 Ctoptop = texture2D(colorTex, offset[2].zw).rgb;
    float Ltoptop = luminance(Ctoptop);
    t = abs(C - Ctoptop);
    lumaDelta = abs(L - Ltoptop);
    delta.w = max(max(t.r, t.g), t.b) + lumaDelta;

    // Calculate the final maximum delta:
    maxDelta = max(max(maxDelta, delta.z), delta.w);

    // Local contrast adaptation in action:
    edges.xy *= step(0.5 * maxDelta, delta.xy);

    return vec4(edges, 0.0, 0.0);
}

void main() {
    gl_FragColor = SMAAColorEdgeDetectionPS(vUv, vOffset, tColor);
}
`;