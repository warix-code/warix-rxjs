import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { arrayMultiSort, arrayPush, arrayRemoveAt, arraySetAt, IWarixArraySortDefinition } from 'warix-core';
import { WarixDataMap } from '../../warix.data-map';
import { WarixDataSubject } from '../../warix.data-subject';
import { isNotEmptyArray } from './common';

export class WarixDataSourceSortOperator {
    private readonly state$: WarixDataSubject<{ sorting: IWarixArraySortDefinition[], unsort: boolean, multiSort: boolean }>;
    private readonly stateMap: WarixDataMap;

    public get allowUnsort() {
        return this.state$.peekKey('unsort');
    }
    public set allowUnsort(value: boolean) {
        this.state$.set('unsort', value);
    }
    public get allowUnsort$() {
        return this.stateMap.get<boolean>('unsort');
    }

    public get multiSort() {
        return this.state$.peekKey('multiSort');
    }
    public set multiSort(value: boolean) {
        this.state$.set('multiSort', value);
    }
    public get multiSort$() {
        return this.stateMap.get<boolean>('multiSort');
    }

    public get sorting() {
        return this.state$.peekKey('sorting');
    }
    public set sorting(value: IWarixArraySortDefinition[]) {
        this.state$.set('sorting', value);
    }
    public get sorting$() {
        return this.stateMap.get<IWarixArraySortDefinition[]>('sorting');
    }

    constructor(allowUnsort: boolean, multiSort: boolean) {
        this.state$ = new WarixDataSubject<{ sorting: IWarixArraySortDefinition[], unsort: boolean, multiSort: boolean }>({
            unsort: allowUnsort,
            multiSort,
            sorting: []
        });
        this.stateMap = new WarixDataMap().liftFromDataSubject(this.state$);
    }

    private sortBy(propertyPath: string, descending: boolean) {
        const currentIndex = this.sorting.findIndex(s => s.property === propertyPath);
        if (currentIndex === -1) {
            if (this.multiSort) {
                this.sorting = arrayPush(this.sorting, { property: propertyPath, descending }).newValue;
            } else {
                this.sorting = [ { property: propertyPath, descending } ];
            }
        } else if (this.sorting[ currentIndex ].descending !== descending) {
            this.sorting = arraySetAt(this.sorting, currentIndex, { property: propertyPath, descending }).newValue;
        }
        return this;
    }

    public apply<T>(dataSource: T[]) {
        return isNotEmptyArray(dataSource) && isNotEmptyArray(this.sorting) ? arrayMultiSort(dataSource, this.sorting).newValue : dataSource;
    }

    public clearSorting() {
        this.sorting = [];
        return this;
    }

    public combine<T = any>(dataSource: Observable<T[]>) {
        return combineLatest([ dataSource, this.sorting$ ]).pipe(map(x => this.apply(x[0])));
    }

    public complete() {
        this.stateMap.complete();
        this.state$.complete();
    }

    public removeSorting(propertyPath: string) {
        const currentIndex = this.sorting.findIndex(s => s.property === propertyPath);
        if (currentIndex > -1) {
            this.sorting = arrayRemoveAt(this.sorting, currentIndex).newValue;
        }
        return this;
    }

    public sortAscendingBy(propertyPath: string) {
        return this.sortBy(propertyPath, false);
    }

    public sortDescendingBy(propertyPath: string) {
        return this.sortBy(propertyPath, true);
    }

    public toggleSort(propertyPath: string) {
        const currentIndex = this.sorting.findIndex(s => s.property === propertyPath);
        if (currentIndex === -1) {
            return this.sortAscendingBy(propertyPath);
        } else {
            const current = this.sorting[ currentIndex ];
            if (current.descending && this.allowUnsort) {
                return this.removeSorting(propertyPath);
            } else {
                return current.descending ? this.sortAscendingBy(propertyPath) : this.sortDescendingBy(propertyPath);
            }
        }
    }
}
