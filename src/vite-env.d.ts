/// <reference types="vite/client" />

declare module '*?worker' {
    const workerConstructor: {
        new(): Worker;
    };
    export default workerConstructor;
}

declare module '*.glsl' {
    const value: string;
    export default value;
}

declare module '*.vert' {
    const value: string;
    export default value;
}

declare module '*.frag' {
    const value: string;
    export default value;
}
