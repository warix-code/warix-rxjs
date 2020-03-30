import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import * as ArrayOps from './warix.array-operations';

export class WarixArraySubject<T> extends BehaviorSubject<T[]> {
    private readonly actionDetails$ = new Subject<ArrayOps.IWarixArrayOperationChange<T>>();

    public get length() {
        return this.getValue().length;
    }

    public get length$() {
        return this.pipe(map(x => x.length), distinctUntilChanged());
    }

    public get isEmpty() {
        return this.length === 0;
    }

    public get isEmpty$() {
        return this.pipe(map(x => x.length === 0), distinctUntilChanged());
    }

    public get first() {
        return this.value[0];
    }

    public get first$() {
        return this.getAt(0);
    }

    public get last() {
        return this.value[this.length - 1];
    }

    public get last$() {
        return this.getAt(this.length - 1);
    }

    public get actions$() {
        return this.actionDetails$.asObservable();
    }

    public get addedItems$() {
        return this.actionDetails$.pipe(map(x => x.addedItems));
    }

    public get removedItems$() {
        return this.actionDetails$.pipe(map(x => x.removedItems));
    }

    public get shiftedItems$() {
        return this.actionDetails$.pipe(map(x => x.shiftedItems));
    }

    private processArrayResult(result: ArrayOps.IWarixArrayOperationChange<T>) {
        if (result.oldValue !== result.newValue) {
            super.next(result.newValue);
            this.actionDetails$.next(result);
        }
        return this;
    }

    public getAt(index: number) {
        return this.pipe(map(x => x[arguments[0]]), distinctUntilChanged());
    }

    public setAt(index: number, value: T) {
        return this.processArrayResult(ArrayOps.arraySetAt(this.value, index, value));
    }

    public peekKey(index: number) {
        return this.value[index];
    }

    public indexOf(value: T) {
        return this.getValue().indexOf(value);
    }
    public indexOf$(value: T) {
        return this.pipe(map(x => x.indexOf(value)), distinctUntilChanged());
    }

    public lastIndexOf(value: T) {
        return this.getValue().lastIndexOf(value);
    }
    public lastIndexOf$(value: T) {
        return this.pipe(map(x => x.lastIndexOf(value)), distinctUntilChanged());
    }

    public findIndex(callback: (item: T, index: number, array: T[]) => boolean) {
        return this.getValue().findIndex(callback);
    }
    public findIndex$(callback: (item: T, index: number, array: T[]) => boolean) {
        return this.pipe(map(array => array.findIndex(callback)), distinctUntilChanged());
    }

    public find(callback: (item: T, index: number, array: T[]) => boolean) {
        return this.getValue().find(callback);
    }
    public find$(callback: (item: T, index: number, array: T[]) => boolean) {
        return this.pipe(map(array => array.find(callback)), distinctUntilChanged());
    }

    public contains(value: T)  {
        return this.indexOf(value) > -1;
    }
    public contains$(value: T) {
        return this.pipe(map(x => x.indexOf(value) > -1), distinctUntilChanged());
    }

    public push(...items: T[]) {
        return this.processArrayResult(ArrayOps.arrayPush(this.value, ...items));
    }

    public pop() {
        return this.processArrayResult(ArrayOps.arrayPop(this.value));
    }

    public shift() {
        return this.processArrayResult(ArrayOps.arrayShift(this.value));
    }

    public unshift(...items: T[]) {
        return this.processArrayResult(ArrayOps.arrayUnshift(this.value, ...items));
    }

    public splice(start: number, deleteCount = 0, ...items: T[]) {
        return this.processArrayResult(ArrayOps.arraySplice(this.value, start, deleteCount, ...items));
    }

    public insert(index: number, ...items: T[]) {
        return this.processArrayResult(ArrayOps.arrayInsert(this.value, index, ...items));
    }

    public moveItem(fromIndex: number, toIndex: number) {
        return this.processArrayResult(ArrayOps.arrayMove(this.value, fromIndex, toIndex));
    }

    public removeAt(index: number, deleteCount = 1) {
        return this.processArrayResult(ArrayOps.arrayRemoveAt(this.value, index, deleteCount));
    }

    public removeWhere(conditionFn: (item: T, index: number, array: T[]) => boolean) {
        return this.processArrayResult(ArrayOps.arrayRemoveWhere(this.value, conditionFn));
    }

    public remove(...items: T[]) {
        return this.processArrayResult(ArrayOps.arrayRemove(this.value, ...items));
    }

    public reverse() {
        return this.processArrayResult(ArrayOps.arrayRevese(this.value));
    }

    public clear() {
        return this.processArrayResult(ArrayOps.arraySet(this.value, []));
    }

    public set(newValue: T[]) {
        return this.processArrayResult(ArrayOps.arraySet(this.value, newValue));
    }

    public shuffle() {
        return this.processArrayResult(ArrayOps.arrayShuffle(this.value));
    }

    public distinct() {
        return this.processArrayResult(ArrayOps.arrayDistinct(this.value));
    }

    public sort(callbackFn?: (a: T, b: T) => number) {
        return this.processArrayResult(ArrayOps.arraySort(this.value, callbackFn));
    }

    public reduce<M>(reducer: (previousValue: M, currentValue: T, currentIndex: number, array: T[]) => M, initialValue: M) {
        return this.pipe(
            map(array => array.reduce(reducer, initialValue)),
            distinctUntilChanged()
        );
    }

    public reduceRight<M>(reducer: (previousValue: M, currentValue: T, currentIndex: number, array: T[]) => M, initialValue: M) {
        return this.pipe(
            map(array => array.reduceRight(reducer, initialValue)),
            distinctUntilChanged()
        );
    }

    public some(callbackFn: (item: T, index: number, array: T[]) => boolean) {
        return this.pipe(map(array => array.some(callbackFn)), distinctUntilChanged());
    }

    public every(callbackFn: (item: T, index: number, array: T[]) => boolean) {
        return this.pipe(map(array => array.every(callbackFn)), distinctUntilChanged());
    }

    public map<M>(callbackFn: (item: T, index: number, array: T[]) => M) {
        return this.pipe(map(array => array.map(callbackFn)), distinctUntilChanged());
    }

    public complete() {
        this.actionDetails$.complete();
        super.complete();
    }
}
