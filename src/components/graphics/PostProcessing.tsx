/**
 * Post-Processing Effects Component
 * 
 * Applies cinematic post-processing effects to the scene:
 * - Bloom (for stars and emissive objects)
 * - Tone Mapping (ACES Filmic)
 * - Chromatic Aberration
 * - Vignette
 * 
 * Effects are controlled by the graphics settings store.
 * SMAA antialiasing is omitted due to type incompatibility.
 */

import React from 'react';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { useGraphicsSettings } from '@/store/graphicsStore';

const PostProcessing: React.FC = () => {
    const settings = useGraphicsSettings();

    return (
        <EffectComposer multisampling={settings.antialiasing ? 8 : 0}>
            <Bloom
                intensity={settings.bloom ? settings.bloomIntensity : 0}
                luminanceThreshold={0.85}
                luminanceSmoothing={0.9}
                mipmapBlur={true}
                blendFunction={BlendFunction.ADD}
            />
            <ChromaticAberration
                offset={settings.chromaticAberration ? [0.0005, 0.0005] : [0, 0]}
                blendFunction={BlendFunction.NORMAL}
            />
            <Vignette
                darkness={settings.vignette ? settings.vignetteIntensity : 0}
                offset={0.5}
                blendFunction={BlendFunction.NORMAL}
            />
            <ToneMapping
                mode={ToneMappingMode.ACES_FILMIC}
                adaptive={false}
                resolution={256}
                middleGrey={0.6}
                maxLuminance={16.0}
                averageLuminance={1.0}
            />
        </EffectComposer>
    );
};

export default PostProcessing;
