import { get as xget, isNil, random, times } from 'lodash';
import { Observable } from 'rxjs';
import { distinctUntilChanged, pluck } from 'rxjs/operators';
import * as ax from './warix.array-operations';
import { WarixDataSubject } from './warix.data-subject';

interface IKeyed {
    [ key: string ]: any;
}

const fnEnsureArray = (a: string | string[]) => Array.isArray(a) ? a : a.split('.');

const fnExtractPathValues = (data: any, path: string | string[]) => {
    const results = [];
    fnEnsureArray(path).forEach((property, index) => {
        if (index === 0) {
            results.push({ property, value: data[ property ] });
        } else {
            results.push({
                property,
                value: isNil(results[ index - 1 ]) ? undefined : results[ index - 1 ].value[ property ] });
        }
    });
    return [ { property: null, value: data }, ...results ].reverse();
};

const fnMutateDeepSet = (data: any, path: string | string[], newValue: any) => {
    const extraction = fnExtractPathValues(data, path);
    const toModify = extraction.shift();
    for (let i = 0; i < extraction.length; i++) {
        if (i === 0) {
            extraction[i].value = Object.assign(extraction[i].value, { [ toModify.property ]: newValue });
        } else {
            extraction[i].value = Object.assign(extraction[i].value, { [ extraction[ i - 1].property ]: extraction[i - 1].value });
        }
    }
    return extraction[ extraction.length - 1 ].value;
};

export class WarixFlatState {
    private readonly state: WarixDataSubject<IKeyed>;

    /**
     * Gets the underlying Observable source
     */
    public get source$() {
        return this.state.asObservable();
    }

    constructor(initial?: IKeyed) {
        this.state = new WarixDataSubject<IKeyed>(initial || Object.create(null));
    }

    /**
     * Generates a unique string id
     */
    public static generateUniqueId() {
        return times(4, i => random(0x1111, 0xFFFF).toString(16)).join('-');
    }

    private inArray(path: string | string[], action: (arr: any[]) => ax.IWarixArrayOperationChange<any>) {
        const arr = xget(this.state.getValue(), fnEnsureArray(path));
        if (arr === null || arr === undefined || Array.isArray(arr)) {
            return this.setIn(path, action(arr || []).newValue);
        } else {
            throw new Error(`InvalidArrayOperation. Array operations can only be performed on Arrays. Expected Array but found ${ typeof(arr) }`);
        }
    }

    public complete() {
        this.state.complete();
    }

    /**
     * Sets the underlying state value with the a deep clone of the provided value
     * @param value New value
     */
    public set(value: IKeyed) {
        this.state.next(value);
        return this;
    }

    /**
     * Obtains an observable to the provided path in the state
     * @param path Path to the property
     */
    public getIn<T = any>(path: string | string[]) {
        return this.state.pipe(pluck(...fnEnsureArray(path)), distinctUntilChanged()) as Observable<T>;
    }

    /**
     * Assigns the provided property path with a deep clone of the provided value
     * @param path Path to the property
     * @param value Value to deep clone assign
     */
    public setIn(path: string | string[], value: any) {
        this.state.next(fnMutateDeepSet(this.state.getValue(), path, value));
        return this;
    }

    /**
     * Obtains a deep clone to the underlying state value
     */
    public peek() {
        return this.state.getValue();
    }

    /**
     * Obtains a deep clone to the property in the underlying state path
     * @param path Path to the property
     */
    public peekKey<T = any>(path: string | string[]) {
        return xget(this.state.getValue(), fnEnsureArray(path)) as T;
    }

    /**
     * Applies a transformation function to the current value at the provided path in the state
     * @param path Path to the property
     * @param action Transformation action
     */
    public apply<T = any>(path: string | string[], action: (currentValue: T) => T) {
        const cc = xget(this.state.getValue(), path);
        return this.setIn(path, action(cc));
    }

    /**
     * Appends items to an array at the provided path in the state
     * @param path Path to the property
     * @param items New items to add at the end of the array
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayPush(path: string | string[], ...items: any[]) {
        return this.inArray(path, a => ax.arrayPush(a, ...items));
    }

    /**
     * Removes an item from the bottom of the array at the provided path in the state
     * @param path Path to the property
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayPop(path: string | string[]) {
        return this.inArray(path, a => ax.arrayPop(a));
    }

    /**
     * Removes an item from the top of the array at the provided path in the state
     * @param path Path to the property
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayShift(path: string | string[]) {
        return this.inArray(path, a => ax.arrayShift(a));
    }

    /**
     * Prepends items to an array at the provided path in the state
     * @param path Path to the property
     * @param items New items to add at the start of the array
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayUnshift(path: string | string[], ...items: any[]) {
        return this.inArray(path, a => ax.arrayUnshift(a, ...items));
    }

    /**
     * Inserts items to an array at the provided path in the state
     * @param path Path to the property
     * @param index Index to insert elements at
     * @param items New items to insert in the array
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayInsert(path: string | string[], index: number, ...items: any[]) {
        return this.inArray(path, a => ax.arrayInsert(a, index, ...items));
    }

    /**
     * Removes items from an array at the provided path in the state
     * @param path Path to the property
     * @param index Index to remove elements at
     * @param deleteCount Number of elements to remove
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayRemoveAt(path: string | string[], index: number, deleteCount = 1) {
        return this.inArray(path, a => ax.arrayRemoveAt(a, index, deleteCount));
    }

    /**
     * Removes items from an array at the provided path in the state
     * @param path Path to the property
     * @param items Elements to remove
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayRemove(path: string | string[], ...items: any[]) {
        return this.inArray(path, a => ax.arrayRemove(a, ...items));
    }

    /**
     * Removes items from an array at the provided path in the state where the provided condition function evaluates to true
     * @param path Path to the property
     * @param condition Evaluation function. Return true to remove the item
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayRemoveWhere(path: string | string[], condition: (value: any, index: number, array: any[]) => boolean) {
        return this.inArray(path, a => ax.arrayRemoveWhere(a, condition));
    }

    /**
     * Reverses an array at the provided path in the state
     * @param path Path to the property
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayReverse(path: string | string[]) {
        return this.inArray(path, a => ax.arrayRevese(a));
    }

    /**
     * Removes all duplicate items from an array at the provided path in the state
     * @param path Path to the property
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayDistinct(path: string | string[]) {
        return this.inArray(path, a => ax.arrayDistinct(a));
    }

    /**
     * Shuffles an array at the provided path in the state
     * @param path Path to the property
     * @throws {InvalidArrayOperation} If the provided path does not point to an array (null or undefined elements are considered empty arrays)
     */
    public arrayShuffle(path: string | string[]) {
        return this.inArray(path, a => ax.arrayShuffle(a));
    }

    public patch(value: Partial<IKeyed>) {
        this.set(Object.assign(this.state.getValue(), value));
        return this;
    }
}
