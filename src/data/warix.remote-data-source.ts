import { cloneDeep, isBoolean, isNil } from 'lodash';
import { combineLatest, isObservable, of, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, take } from 'rxjs/operators';
import { arrayInsert, arrayPush, arrayRemoveAt, arraySetAt, IWarixArraySortDefinition, IWarixArrayGrouping } from 'warix-core';
import { WarixDataMap } from '../warix.data-map';
import { WarixDataSubject } from '../warix.data-subject';

export type WarixRemoteDataSourceAcceptSortCallback = (current: IWarixArraySortDefinition[], next: IWarixArraySortDefinition[]) =>
    boolean | Observable<boolean> | IWarixArraySortDefinition[] | Observable<IWarixArraySortDefinition[]>;

export type WarixRemoteDataSourceAcceptFilterCallback = (current: { [key: string]: any }, next: { [key: string]: any }) =>
    boolean | Observable<boolean> | { [key: string]: any } | Observable<{ [ key: string ]: any }>;

export type WarixRemoteDataSourceAcceptGroupCallback = (current: string[], next: string[]) =>
    boolean | Observable<boolean> | string[] | Observable<string[]>;

export type WarixRemoteDataSourceAcceptPageCallback = (current: number, nextPage: number) =>
    boolean | Observable<boolean> | number | Observable<number>;

export type WarixRemoteDataSourceDataCallback<T = any> = (params: IWarixRemoteDataSourceParams) => IWarixRemoteDataSourceResult<T> | Observable<IWarixRemoteDataSourceResult<T>>;

export interface IWarixRemoteDataSourceBase {
    filterValues: { [ key: string ]: any };
    grouping: string[];
    page: number;
    rowsPerPage: number;
    sorting: IWarixArraySortDefinition[];
}

export interface IWarixRemoteDataSourceState<T = any> extends IWarixRemoteDataSourceBase {
    acceptFilterChange?: WarixRemoteDataSourceAcceptFilterCallback;
    acceptGroupChange?: WarixRemoteDataSourceAcceptGroupCallback;
    acceptPageChange?: WarixRemoteDataSourceAcceptPageCallback;
    acceptSortChange?: WarixRemoteDataSourceAcceptSortCallback;
    allowUnsort: boolean;
    data: T[];
    dataRequest: WarixRemoteDataSourceDataCallback<T>;
    multiSort: boolean;
    totalCount: number;
}

export interface IWarixRemoteDataSourceParams extends IWarixRemoteDataSourceBase {
    take: number;
    skip: number;
}

export interface IWarixRemoteDataSourceResult<T = any> {
    data: T[];
    totalCount: number;
    page: number;
}

export class WarixRemoteDataSource<T = any> {
    private readonly state$: WarixDataSubject<IWarixRemoteDataSourceState<T>>;
    private readonly stateMap: WarixDataMap;
    private pageIsMuted = false;

    public get acceptFilterChange() {
        return this.state$.peekKey('acceptFilterChange');
    }
    public set acceptFilterChange(value: WarixRemoteDataSourceAcceptFilterCallback) {
        this.state$.set('acceptFilterChange', value);
    }

    public get acceptGroupChange() {
        return this.state$.peekKey('acceptGroupChange');
    }
    public set acceptGroupChange(value: WarixRemoteDataSourceAcceptGroupCallback) {
        this.state$.set('acceptGroupChange', value);
    }

    public get acceptPageChange() {
        return this.state$.peekKey('acceptPageChange');
    }
    public set acceptPageChange(value: WarixRemoteDataSourceAcceptPageCallback) {
        this.state$.set('acceptPageChange', value);
    }

    public get acceptSortChange() {
        return this.state$.peekKey('acceptSortChange');
    }
    public set acceptSortChange(value: WarixRemoteDataSourceAcceptSortCallback) {
        this.state$.set('acceptSortChange', value);
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

    public get data() {
        return this.state$.peekKey('data');
    }
    public set data(value: T[]) {
        this.state$.set('data', value);
    }
    public get data$() {
        return this.stateMap.get<T[]>('data');
    }

    public get dataRequest() {
        return this.state$.peekKey('dataRequest');
    }
    public set dataRequest(value: WarixRemoteDataSourceDataCallback<T>) {
        this.state$.set('dataRequest', value);
    }
    public get dataRequest$() {
        return this.stateMap.get<WarixRemoteDataSourceDataCallback<T>>('dataRequest');
    }

    public get filterValues() {
        return this.state$.peekKey('filterValues');
    }
    public set filterValues(value: { [ key: string ]: any}) {
        this.applyFilterChange(value || Object.create(null));
    }
    public get filterValues$() {
        return this.stateMap.get<{ [ key: string ]: any}>('filterValues');
    }

    public get grouping() {
        return this.state$.peekKey('grouping');
    }
    public set grouping(value: string[]) {
        this.applyGroupChange(value || []);
    }
    public get grouping$() {
        return this.stateMap.get<string[]>('grouping');
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
        return this.calculatePagesCount(this.totalCount || 0, this.rowsPerPage);
    }
    public get pagesCount$() {
        if (!this.stateMap.has('pagesCount')) {
            this.stateMap.set('pagesCount', combineLatest([ this.totalCount$, this.rowsPerPage$ ]).pipe(
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
        this.applySortChange(value || []);
    }
    public get sorting$() {
        return this.stateMap.get<IWarixArraySortDefinition[]>('sorting');
    }

    public get totalCount() {
        return this.state$.peekKey('totalCount');
    }
    public set totalCount(value: number) {
        this.state$.set('totalCount', value);
    }
    public get totalCount$() {
        return this.stateMap.get<number>('totalCount');
    }

    constructor(dataRequest: WarixRemoteDataSourceDataCallback<T>, initial?: Partial<IWarixRemoteDataSourceState<T>>) {
        this.state$ = new WarixDataSubject<IWarixRemoteDataSourceState<T>>(Object.assign({
            acceptFilterChange: null,
            acceptGroupChange: null,
            acceptPageChange: null,
            acceptSortChange: null,
            allowUnsort: true,
            data: [],
            dataRequest: null,
            filterValues: Object.create(null),
            grouping: [],
            multiSort: true,
            page: null,
            rowsPerPage: null,
            sorting: [],
            totalCount: null
        }, initial, {
            dataRequest
        }));
        this.stateMap = new WarixDataMap().liftFromDataSubject(this.state$);

        combineLatest([ this.filterValues$, this.grouping$, this.page$.pipe(filter(x => !this.pageIsMuted)), this.rowsPerPage$, this.sorting$ ])
            .pipe(debounceTime(10))
            .subscribe(x => this.performDataRequest());
    }

    private applyFilterChange(newFilter: { [key: string]: any }) {
        if (newFilter === this.filterValues) {
            return;
        }
        const delta = this.acceptFilterChange ? this.acceptFilterChange(this.filterValues, newFilter) : of(true);
        (isObservable(delta) ? delta : of(delta)).pipe(take(1)).subscribe(x => {
            if (isBoolean(x)) {
                if (x) {
                    this.state$.set('filterValues', newFilter);
                }
            } else {
                if (!isNil(x)) {
                    this.state$.set('filterValues', x);
                }
            }
        });
    }

    private applyGroupChange(newGroup: string[]) {
        if (newGroup === this.grouping) {
            return;
        }
        const delta = this.acceptGroupChange ? this.acceptGroupChange(this.grouping, newGroup) : of(true);
        (isObservable(delta) ? delta : of(delta)).pipe(take(1)).subscribe(x => {
            if (isBoolean(x)) {
                if (x) {
                    this.state$.set('grouping', newGroup);
                }
            } else {
                if (!isNil(x)) {
                    this.state$.set('grouping', x);
                }
            }
        });
    }

    private applyPageChange(newPage: number) {
        if (newPage === this.page) {
            return;
        }
        const delta = this.acceptPageChange ? this.acceptPageChange(this.page, newPage) : of(true);
        (isObservable(delta) ? delta : of(delta)).pipe(take(1)).subscribe(x => {
            if (isBoolean(x)) {
                if (x) {
                    this.state$.set('page', newPage);
                }
            } else {
                if (!isNil(x)) {
                    this.state$.set('page', x);
                }
            }
        });
    }

    private applySortChange(newSort: IWarixArraySortDefinition[]) {
        if (newSort === this.sorting) {
            return;
        }
        const delta = this.acceptSortChange ? this.acceptSortChange(this.sorting, newSort) : of(true);
        (isObservable(delta) ? delta : of(delta)).pipe(take(1)).subscribe(x => {
            if (isBoolean(x)) {
                if (x) {
                    this.state$.set('sorting', newSort);
                }
            } else {
                if (!isNil(x)) {
                    this.state$.set('sorting', x);
                }
            }
        });
    }

    private calculatePagesCount(dataLength: number, rowsPerPage: number) {
        return dataLength === 0 ? 0 : rowsPerPage === 0 ? 1 : Math.ceil(dataLength / rowsPerPage);
    }

    private getRequestParams() {
        return Object.freeze({
            filterValues: cloneDeep(this.filterValues),
            grouping: (this.grouping || []).slice(0),
            page: this.page,
            rowsPerPage: this.rowsPerPage,
            skip: (this.rowsPerPage || 0) * (this.page || 0),
            take: (this.rowsPerPage || 0),
            sorting: (this.sorting || []).slice(0)
        }) as IWarixRemoteDataSourceParams;
    }

    private performDataRequest() {
        if (this.dataRequest) {
            const delta = this.dataRequest(this.getRequestParams());
            (isObservable(delta) ? delta : of(delta)).pipe(take(1)).subscribe(x => {
                this.pageIsMuted = true;
                this.state$.patch(x);
                this.pageIsMuted = false;
            });
        }
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

    public addFilter(key: string, value: any) {
        this.filterValues = Object.assign({}, this.filterValues, { [key]: value });
        return this;
    }

    public removeFilter(key: string) {
        if (key in this.filterValues) {
            const clone = cloneDeep(this.filterValues);
            delete clone[ key ];
            this.filterValues = clone;
        }
        return this;
    }

    public clearFilter() {
        this.filterValues = Object.create(null);
        return this;
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
        const max = this.calculatePagesCount(this.totalCount || 0, rpp);

        this.state$.set('rowsPerPage', isNil(rowsPerPage) ? rowsPerPage : rpp);
        this.applyPageChange(ppp);
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