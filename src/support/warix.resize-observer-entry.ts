import { IWarixResizeObserverEntry, IBounds, IPoint, ISize, IExBounds } from './interfaces';
import { isNil } from 'lodash';

export class WarixResizeObserverEntry implements IWarixResizeObserverEntry {
    private previousBounds: IBounds;
    private currentBounds: IBounds;

    public get left() {
        return this.currentBounds.left;
    }

    public get top() {
        return this.currentBounds.top;
    }

    public get width() {
        return this.currentBounds.width;
    }

    public get height() {
        return this.currentBounds.height;
    }

    public get right() {
        return this.left + this.width;
    }

    public get bottom() {
        return this.top + this.height;
    }

    public get xDifference() {
        return this.left - this.previousBounds.left;
    }

    public get yDifference() {
        return this.top - this.previousBounds.top;
    }

    public get widthDifference() {
        return this.width - this.previousBounds.width;
    }

    public get heightDifference() {
        return this.height - this.previousBounds.height;
    }

    public get hasLocationChanges() {
        return this.xDifference !== 0 || this.yDifference !== 0;
    }

    public get hasSizeChanges() {
        return this.widthDifference !== 0 || this.heightDifference !== 0;
    }

    public get hasChanges() {
        return this.hasLocationChanges || this.hasSizeChanges;
    }

    public get element() {
        return this.domElement;
    }

    constructor(private domElement: HTMLElement) {
        this.update();
    }

    public offsetPosition(): IPoint {
        let e = this.domElement;
        const coords = { x: 0, y: 0 };
        while (e) {
            coords.x += e.offsetLeft;
            coords.y += e.offsetTop;
            e = e.offsetParent as HTMLElement;
        }
        return coords;
    }

    public offsetSize(): ISize {
        return { width: this.element.offsetWidth, height: this.element.offsetHeight };
    }

    public offsetBounds(): IExBounds {
        const p = this.offsetPosition();
        const s = this.offsetSize();
        return Object.assign({}, p, s, {
            left: p.x,
            top: p.y,
            right: p.x + s.width,
            bottom: p.y + s.height,
            cx: p.x + (s.width * .5),
            cy: p.y + (s.height * .5)
        });
    }

    public update() {
        const temp = this.offsetBounds();
        if (isNil(this.previousBounds)) {
            this.previousBounds = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
        } else {
            this.previousBounds = Object.assign({}, this.currentBounds);
        }
        this.currentBounds = Object.assign({}, temp);
    }
}
