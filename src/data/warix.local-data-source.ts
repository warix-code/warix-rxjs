import { isNil, times } from 'lodash';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import {
    arrayGroupBy, arrayInsert, arrayMultiSort, arrayPush, arrayRemoveAt, arraySetAt, compileGroup, groupProperties,
    IWarixArrayGrouping, IWarixArraySortDefinition, IWarixDataFilterGroup
} from 'warix-core';
import { WarixDataMap } from '../warix.data-map';
import { WarixDataSubject } from '../warix.data-subject';

export interface IWarixLocalDataSourceState<T = any> {
    allowUnsort: boolean;
    data: T[];
    filtering: IWarixDataFilterGroup;
    grouping: string[];
    multiSort: boolean;
    page: number;
    rowsPerPage: number;
    sorting: IWarixArraySortDefinition[];
}

export interface IWarixLocalDataSourcePagerItem {
    display: number;
    isSelected: boolean;
    value: number;
}

export class WarixLocalDataSource<T = any> {
    private readonly state$: WarixDataSubject<IWarixLocalDataSourceState<T>>;
    private readonly stateMap: WarixDataMap;

    public get data() {
        return this.state$.peekKey('data');
    }
    public set data(value: T[]) {
        this.state$.set('data', value);
    }
    public get data$() {
        return this.stateMap.get<T[]>('data');
    }

    public get dataLength() {
        return (this.data || []).length;
    }
    public get dataLength$() {
        if (!this.stateMap.has('dataLength')) {
            this.stateMap.set('dataLength', this.data$.pipe(map(x => (x || []).length), distinctUntilChanged()));
        }
        return this.stateMap.get<number>('dataLength');
    }

    public get allowUnsort() {
        return this.state$.peekKey('allowUnsort');
    }
    public set allowUnsort(value: boolean) {
        this.state$.set('allowUnsort', value);
    }
    public get allowUnsort$() {
        return this.stateMap.get<boolean>('allowUnsort');
    }

    public get filtering() {
        return this.state$.peekKey('filtering');
    }
    public set filtering(value: IWarixDataFilterGroup) {
        this.state$.set('filtering', value);
    }
    public get filtering$() {
        return this.stateMap.get<IWarixDataFilterGroup>('filtering');
    }

    public get filterFields() {
        return !isNil(this.filtering) ? groupProperties(this.filtering) : [];
    }
    public get filterFields$() {
        if (!this.stateMap.has('filterFields')) {
            this.stateMap.set('filterFields', this.filtering$.pipe(map(x => isNil(x) ? [] : groupProperties(x))));
        }
        return this.stateMap.get<string[]>('filterFields');
    }

    public get grouping() {
        return this.state$.peekKey('grouping');
    }
    public set grouping(value: string[]) {
        this.state$.set('grouping', value);
    }
    public get grouping$() {
        return this.stateMap.get<string[]>('grouping');
    }

    public get hasGrouping() {
        return this.grouping.length > 0;
    }
    public get hasGrouping$() {
        if (!this.stateMap.has('hasGrouping')) {
            this.stateMap.set('hasGrouping', this.grouping$.pipe(map(x => x.length > 0), distinctUntilChanged()));
        }
        return this.stateMap.get<boolean>('hasGrouping');
    }

    public get inFirstPage() {
        return (this.page || 0) === 0;
    }
    public get inFirstPage$() {
        if (!this.stateMap.has('inFirstPage')) {
            this.stateMap.set('inFirstPage', this.page$.pipe(map(x => (x || 0) === 0), distinctUntilChanged()));
        }
        return this.stateMap.get<boolean>('inFirstPage');
    }

    public get inLastPage() {
        return this.pagesCount - 1 === (this.page || 0);
    }
    public get inLastPage$() {
        if (!this.stateMap.has('inLastPage')) {
            this.stateMap.set('inLastPage', combineLatest([ this.pagesCount$, this.page$ ]).pipe(map(x => x[0] - 1 === (x[1] || 0)), distinctUntilChanged()));
        }
        return this.stateMap.get<boolean>('inLastPage');
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

    public get page() {
        return this.state$.peekKey('page');
    }
    public set page(value: number) {
        this.paging(this.rowsPerPage, value);
    }
    public get page$() {
        return this.stateMap.get<number>('page');
    }

    public get pagesCount() {
        return this.calculatePagesCount(this.dataLength, this.rowsPerPage);
    }
    public get pagesCount$() {
        if (!this.stateMap.has('pagesCount')) {
            this.stateMap.set('pagesCount', combineLatest([ this.dataLength$, this.rowsPerPage$ ]).pipe(
                map(values => this.calculatePagesCount(values[0], values[1] || 0)),
                distinctUntilChanged()
            ));
        }
        return this.stateMap.get<number>('pagesCount');
    }

    public get rowsPerPage() {
        return this.state$.peekKey('rowsPerPage');
    }
    public set rowsPerPage(value: number) {
        this.paging(value, this.page);
    }
    public get rowsPerPage$() {
        return this.stateMap.get<number>('rowsPerPage');
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

    public get workSource$() {
        return this.stateMap.get<T[]>('workSource');
    }

    public get groupingSource$() {
        return this.stateMap.get<IWarixArrayGrouping<T>[]>('groupingSource');
    }

    public get pagingSource$() {
        return this.stateMap.get<IWarixLocalDataSourcePagerItem[]>('pagingSource');
    }

    constructor(initial?: Partial<IWarixLocalDataSourceState>) {
        this.state$ = new WarixDataSubject<IWarixLocalDataSourceState<T>>(Object.assign({
            allowUnsort: true,
            data: [],
            filtering: null,
            grouping: [],
            multiSort: true,
            page: null,
            rowsPerPage: null,
            sorting: []
        }, initial));
        this.stateMap = new WarixDataMap().liftFromDataSubject(this.state$);
        this.stateMap.set('workSource', this.constructWorkSource());
        this.stateMap.set('groupingSource', this.constructGroupingSource());
        this.stateMap.set('pagingSource', this.constructPagingSource());
    }

    private calculatePagesCount(dataLength: number, rowsPerPage: number) {
        return dataLength === 0 ? 0 : rowsPerPage === 0 ? 1 : Math.ceil(dataLength / rowsPerPage);
    }

    private constructGroupingSource() {
        return combineLatest([ this.stateMap.get<T[]>('workSource'), this.grouping$ ])
            .pipe(
                map((values: [ T[], string[] ]) => arrayGroupBy(values[0], ...values[1]))
            );
    }

    private constructPagingSource() {
        return combineLatest([ this.pagesCount$, this.page$ ])
            .pipe(
                map((values: [ number, number ]) => {
                    return times(values[0], i => {
                        return {
                            display: (i + 1),
                            isSelected: i === (values[1] || 0),
                            value: i
                        } as IWarixLocalDataSourcePagerItem;
                    });
                })
            );
    }

    private constructWorkSource() {
        return combineLatest([ this.data$, this.rowsPerPage$, this.page$, this.filtering$, this.sorting$ ])
            .pipe(
                map((values: [ T[], number, number, IWarixDataFilterGroup, IWarixArraySortDefinition[]] ) => {
                    let dt = values[0] || [];

                    if (values[4] && values[4].length > 0) {
                        dt = arrayMultiSort(dt, values[4]).newValue;
                    }

                    if (!isNil(values[3])) {
                        const compiled = compileGroup(values[3]);
                        dt = dt.filter(x => compiled(x));
                    }

                    if (!isNil(values[1]) && !isNil(values[2])) {
                        dt = dt.slice(values[1] * values[2], values[1] * (values[2] + 1));
                    }

                    return dt;
                })
            );
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

    public complete() {
        this.stateMap.complete();
        this.state$.complete();
    }

    public addGrouping(propertyPath: string) {
        if (!this.grouping.includes(propertyPath)) {
            this.grouping = arrayPush(this.grouping, propertyPath).newValue;
        }
        return this;
    }

    public insertGrouping(index: number, propertyPath: string) {
        if (!this.grouping.includes(propertyPath)) {
            this.grouping = arrayInsert(this.grouping, index, propertyPath).newValue;
        }
        return this;
    }

    public removeGrouping(propertyPath: string) {
        if (this.grouping.includes(propertyPath)) {
            this.grouping = arrayRemoveAt(this.grouping, this.grouping.indexOf(propertyPath)).newValue;
        }
        return this;
    }

    public clearGrouping(propertyPath: string) {
        if (this.grouping.length > 0) {
            this.grouping = [];
        }
        return this;
    }

    public clearSorting() {
        this.sorting = [];
        return this;
    }

    public removeSorting(propertyPath: string) {
        const currentIndex = this.sorting.findIndex(s => s.property === propertyPath);
        if (currentIndex > -1) {
            this.sorting = arrayRemoveAt(this.sorting, currentIndex).newValue;
        }
        return this;
    }

    public sortByAsc(propertyPath: string) {
        return this.sortBy(propertyPath, false);
    }

    public sortByDesc(propertyPath: string) {
        return this.sortBy(propertyPath, true);
    }

    public toggleSort(propertyPath: string) {
        const currentIndex = this.sorting.findIndex(s => s.property === propertyPath);
        if (currentIndex === -1) {
            return this.sortByAsc(propertyPath);
        } else {
            const current = this.sorting[ currentIndex ];
            if (current.descending && this.allowUnsort) {
                return this.removeSorting(propertyPath);
            } else {
                return current.descending ? this.sortByAsc(propertyPath) : this.sortByDesc(propertyPath);
            }
        }
    }

    public paging(rowsPerPage: number, page: number) {
        const rpp = Math.abs(rowsPerPage || 0);
        const ppp = Math.abs(page || 0);
        const max = this.calculatePagesCount(this.dataLength, rpp);

        this.state$.patch({
            rowsPerPage: isNil(rowsPerPage) ? rowsPerPage : rpp,
            page: isNil(page) ? page : ppp > max ? max : ppp
        });
        return this;
    }

    public goToFirstPage() {
        return this.paging(this.rowsPerPage, 0);
    }

    public goToLastPage() {
        return this.paging(this.rowsPerPage, this.pagesCount - 1);
    }

    public goToPage(page: number) {
        return this.paging(this.rowsPerPage, page);
    }

    public goToNextPage() {
        if (!this.inLastPage) {
            this.goToPage(this.page + 1);
        }
        return this;
    }

    public goToPreviousPage() {
        if (this.page > 0) {
            this.goToPage(this.page - 1);
        }
        return this;
    }
}
