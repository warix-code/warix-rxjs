import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { arrayGroupBy } from 'warix-core';
import { WarixArraySubject } from '../../warix.array-subject';

export class WarixDataGroupingOperator {
    private readonly state$: WarixArraySubject<string>;
    private readonly stateObs$: Observable<string[]>;

    public get value() {
        return this.state$.getValue();
    }
    public set value(value: string[]) {
        this.state$.next(value);
    }
    public get value$() {
        return this.stateObs$;
    }

    constructor() {
        this.state$ = new WarixArraySubject<string>([]);
        this.stateObs$ = this.state$.asObservable();
    }

    public add(value: string) {
        if (!this.value.includes(value)) {
            this.state$.push(value);
        }
        return this;
    }

    public apply<T = any>(dataSource: T[]) {
        return arrayGroupBy(dataSource || [], ...(this.value || []));
    }

    public clear() {
        this.value = [];
        return this;
    }

    public combine<T = any>(dataSource: Observable<T[]>) {
        return combineLatest([ dataSource, this.value$ ]).pipe(map(x => this.apply(x[0])));
    }

    public complete() {
        this.state$.complete();
    }

    public insert(index: number, value: string) {
        if (!this.value.includes(value)) {
            this.state$.insert(index, value);
        }
        return this;
    }

    public remove(...values: string[]) {
        this.state$.remove(...values);
        return this;
    }

    public removeAt(index: number, removeCount = 1) {
        this.state$.removeAt(index, removeCount);
        return this;
    }
}
