import React from 'react';
import { PROVIDERS } from '../constants/providers';

const Footer = ({ currentModel, version = "v0.1.0 alpha", onNavigateToSettings }) => {

    //Helper to find the label for the current model value
    const getModelLabel = (modelValue) => {
        if (!modelValue) return null;

        //Search all providers
        for (const providerKey in PROVIDERS) {
            const provider = PROVIDERS[providerKey];
            const foundModel = provider.models.find(m => m.value === modelValue);
            if (foundModel) {
                return foundModel.label;
            }
        }

        return modelValue; //Fallback to raw value
    };

    const displayModel = getModelLabel(currentModel);

    return (
        <footer className="h-8 bg-[#f9f7f0] border-t border-[#e8e3d3] flex items-center justify-between px-4 text-xs font-bold text-[#9c8b77] shrink-0 z-50">
            {/*Left: Model Info */}
            <div className="flex items-center gap-2">
                {currentModel ? (
                    <span className="text-[#88c9a1]">
                        Selected AI Model: <span className="text-[#5c4b37]">{displayModel}</span>
                    </span>
                ) : (
                    <button
                        onClick={onNavigateToSettings}
                        className="text-[#ef5350] hover:underline cursor-pointer flex items-center gap-1"
                    >
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        Select AI Model
                    </button>
                )}
            </div>

            {/*Right: Version: Husk for now */}
            <div className="opacity-50">
                {version}
            </div>
        </footer>
    );
};

export default Footer;
