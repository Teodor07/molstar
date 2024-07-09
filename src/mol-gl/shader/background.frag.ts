export const background_frag = `
precision mediump float;
precision mediump samplerCube;
precision mediump sampler2D;

#if defined(dVariant_skybox)
    uniform samplerCube tSkybox;
    uniform mat4 uViewDirectionProjectionInverse;
    uniform float uBlur;
    uniform float uOpacity;
    uniform float uSaturation;
    uniform float uLightness;
    uniform mat3 uRotation;
#elif defined(dVariant_image)
    uniform sampler2D tImage;
    uniform vec2 uImageScale;
    uniform vec2 uImageOffset;
    uniform float uBlur;
    uniform float uOpacity;
    uniform float uSaturation;
    uniform float uLightness;
#elif defined(dVariant_horizontalGradient) || defined(dVariant_radialGradient)
    uniform vec3 uGradientColorA;
    uniform vec3 uGradientColorB;
    uniform float uGradientRatio;
#endif

uniform vec2 uTexSize;
uniform vec4 uViewport;
uniform bool uViewportAdjusted;
varying vec4 vPosition;

vec3 ScreenSpaceDither(vec2 vScreenPos) {
    vec3 vDither = vec3(dot(vec2(171.0, 231.0), vScreenPos.xy + g_flTime));
    vDither.rgb = fract(vDither.rgb / vec3(103.0, 71.0, 97.0)) - vec3(0.5, 0.5, 0.5);
    return (vDither.rgb / 255.0) * 0.375;
}

vec3 saturateColor(vec3 c, float amount) {
    // https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
    const vec3 W = vec3(0.2125, 0.7154, 0.0721);
    vec3 intensity = vec3(dot(c, W));
    return mix(intensity, c, 1.0 + amount);
}

vec3 lightenColor(vec3 c, float amount) {
    return c + amount;
}

void main() {
    vec3 dither = ScreenSpaceDither(gl_FragCoord.xy);

    #if defined(dVariant_skybox)
        vec4 t = uViewDirectionProjectionInverse * vPosition;
        #ifdef enabledShaderTextureLod
            gl_FragColor = textureCubeLodEXT(tSkybox, uRotation * normalize(t.xyz / t.w), uBlur * 8.0);
        #else
            gl_FragColor = textureCube(tSkybox, uRotation * normalize(t.xyz / t.w));
        #endif
        gl_FragColor.a = uOpacity;
        gl_FragColor.rgb = lightenColor(saturateColor(gl_FragColor.rgb, uSaturation), uLightness) + dither;
    #elif defined(dVariant_image)
        vec2 coords;
        if (uViewportAdjusted) {
            coords = ((gl_FragCoord.xy - uViewport.xy) * (uTexSize / uViewport.zw) / uImageScale) + uImageOffset;
        } else {
            coords = (gl_FragCoord.xy / uImageScale) + uImageOffset;
        }
        #ifdef enabledShaderTextureLod
            gl_FragColor = texture2DLodEXT(tImage, vec2(coords.x, 1.0 - coords.y), uBlur * 8.0);
        #else
            gl_FragColor = texture2D(tImage, vec2(coords.x, 1.0 - coords.y));
        #endif
        gl_FragColor.a = uOpacity;
        gl_FragColor.rgb = lightenColor(saturateColor(gl_FragColor.rgb, uSaturation), uLightness) + dither;
    #elif defined(dVariant_horizontalGradient)
        float d;
        if (uViewportAdjusted) {
            d = ((gl_FragCoord.y - uViewport.y) * (uTexSize.y / uViewport.w) / uTexSize.y) + 1.0 - (uGradientRatio * 2.0);
        } else {
            d = (gl_FragCoord.y / uTexSize.y) + 1.0 - (uGradientRatio * 2.0);
        }
        gl_FragColor = vec4(mix(uGradientColorB, uGradientColorA, clamp(d, 0.0, 1.0)), 1.0);
        gl_FragColor.rgb += dither;
    #elif defined(dVariant_radialGradient)
        float d;
        if (uViewportAdjusted) {
            d = distance(vec2(0.5), (gl_FragCoord.xy - uViewport.xy) * (uTexSize / uViewport.zw) / uTexSize) + uGradientRatio - 0.5;
        } else {
            d = distance(vec2(0.5), gl_FragCoord.xy / uTexSize) + uGradientRatio - 0.5;
        }
        gl_FragColor = vec4(mix(uGradientColorB, uGradientColorA, 1.0 - clamp(d, 0.0, 1.0)), 1.0);
        gl_FragColor.rgb += dither;
    #endif
}
`;
