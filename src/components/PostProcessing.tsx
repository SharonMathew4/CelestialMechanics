/**
 * Post-processing effects component
 * 
 * Renders bloom, chromatic aberration, vignette, and SMAA
 * based on graphics quality settings.
 */

import React from 'react';
import {
    EffectComposer,
    Bloom,
    Vignette,
    SMAA,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useGraphicsSettings } from '@/store/graphicsStore';

export function PostProcessing() {
    const {
        bloom,
        vignette,
        antialiasing,
        bloomIntensity,
        vignetteIntensity,
    } = useGraphicsSettings();

    // Only render EffectComposer if at least one effect is active
    const hasEffects = bloom || vignette || antialiasing;
    if (!hasEffects) return null;

    return (
        <EffectComposer multisampling={0}>
            <Bloom
                luminanceThreshold={bloom ? 0.6 : 999}
                luminanceSmoothing={0.3}
                intensity={bloom ? bloomIntensity : 0}
                mipmapBlur
            />
            <Vignette
                offset={0.3}
                darkness={vignette ? vignetteIntensity : 0}
                blendFunction={BlendFunction.NORMAL}
            />
            {antialiasing ? <SMAA /> : <React.Fragment />}
        </EffectComposer>
    );
}

export default PostProcessing;
