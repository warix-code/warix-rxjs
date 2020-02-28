export interface IDOMPoint {
    left: number;
    top: number;
}

export interface IPoint {
    x: number;
    y: number;
}

export interface ISize {
    width: number;
    height: number;
}

export interface IBounds extends IDOMPoint, ISize {
    right: number;
    bottom: number;
}

export interface IExBounds extends IBounds, IPoint {
    cx: number;
    cy: number;
}

export interface IWarixResizeObserverEntry {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
    readonly right: number;
    readonly bottom: number;
    readonly xDifference: number;
    readonly yDifference: number;
    readonly widthDifference: number;
    readonly heightDifference: number;
    readonly hasLocationChanges: boolean;
    readonly hasSizeChanges: boolean;
    readonly hasChanges: boolean;
    readonly element: HTMLElement;
}
