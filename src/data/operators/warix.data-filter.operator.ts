import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { compileGroup, groupProperties, IWarixDataFilterGroup, IWarixDataFilterProvider } from 'warix-core';
import { WarixDataMap } from '../../warix.data-map';
import { WarixDataSubject } from '../../warix.data-subject';
import { isNotEmptyArray } from './common';

export type WarixDataFilter<T> = (data: T, index: number, array: T[]) => boolean;

export class WarixDataSourceFilterOperator<T = any> {
    private readonly state$: WarixDataSubject<{ filter: WarixDataFilter<T>, involvedFields: string[] }>;
    private readonly stateMap: WarixDataMap;

    public get filter() {
        return this.state$.peekKey('filter');
    }
    public set filter(value: WarixDataFilter<T>) {
        this.state$.set('filter', value);
    }
    public get filter$() {
        return this.stateMap.get<WarixDataFilter<T>>('filter');
    }

    public get involvedFields() {
        return this.state$.peekKey('involvedFields');
    }
    public set involvedFields(value: string[]) {
        this.state$.set('involvedFields', value);
    }
    public get involvedFields$() {
        return this.stateMap.get<string[]>('involvedFields');
    }

    constructor() {
        this.state$ = new WarixDataSubject<{ filter: WarixDataFilter<T>, involvedFields: string[]}>({
            filter: null,
            involvedFields: []
        });
        this.stateMap = new WarixDataMap().liftFromDataSubject(this.state$);
    }

    public apply(dataSource: T[]) {
        if (this.filter && isNotEmptyArray(dataSource)) {
            return dataSource.filter(this.filter);
        }
        return dataSource;
    }

    public clear() {
        this.state$.patch({
            filter: null,
            involvedFields: []
        });
        return this;
    }

    public combine(dataSource: Observable<T[]>) {
        return combineLatest([ dataSource, this.filter$ ]).pipe(map(x => this.apply(x[0])));
    }

    public complete() {
        this.stateMap.complete();
        this.state$.complete();
    }

    public filterWith(filterGroup: IWarixDataFilterGroup, ...providers: IWarixDataFilterProvider[]) {
        this.state$.patch({
            filter: compileGroup(filterGroup, ...providers),
            involvedFields: groupProperties(filterGroup)
        });
        return this;
    }
}
