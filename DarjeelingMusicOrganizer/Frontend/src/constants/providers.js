import { Gemini, OpenAI, Claude, Grok } from '@lobehub/icons';

export const PROVIDERS = {
    Google: {
        id: 'Google',
        label: 'Google',
        icon: Gemini,
        defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
        models: [
            { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash' },
            { value: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro' },
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
        ]
    },
    OpenAI: {
        id: 'OpenAI',
        label: 'OpenAI',
        icon: OpenAI,
        defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
        models: [
            { value: 'gpt5.2', label: 'GPT 5.2' }
        ]
    },
    Claude: {
        id: 'Claude',
        label: 'Claude',
        icon: Claude,
        defaultEndpoint: 'https://api.anthropic.com/v1/messages',
        models: [
            { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
        ]
    },
    Grok: {
        id: 'Grok',
        label: 'Grok',
        icon: Grok,
        defaultEndpoint: 'https://api.x.ai/v1/chat/completions',
        models: [
            { value: 'grok-1', label: 'Grok-1' }
        ]
    }
};
