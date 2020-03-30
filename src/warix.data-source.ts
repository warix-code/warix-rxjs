import { isArray, isFunction, isNumber } from 'lodash';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { arrayGroupBy, arrayMultiSort, arrayPush, arrayRemove, arrayRemoveAt, arraySetAt, IWarixArrayGrouping, IWarixArraySortDefinition } from './warix.array-operations';
import { WarixDataSubject } from './warix.data-subject';

interface IWarixDataSourceState<T extends { [key: string]: any }> {
    data: T[];
    rowsPerPage?: number;
    page?: number;
    sorting?: IWarixArraySortDefinition[];
    multiSort?: boolean;
    unsort?: boolean;
    grouping?: string[];
    filter?: (data: T, index: number, array: T[]) => boolean;
}

export enum WarixDataSourceSortMode {
    None = 0,
    Ascending = 1,
    Descending = -1
}

export class WarixDataSource<T extends { [key: string]: any }> {
    private readonly state: WarixDataSubject<IWarixDataSourceState<T>>;
    private readonly dataMapping: Observable<T[] | IWarixArrayGrouping<T>[]>;

    public get dataSource$() {
        return this.dataMapping;
    }

    public get data() {
        return this.state.peekKey('data');
    }
    public set data(value: T[]) {
        this.applyData(value);
    }
    public get data$() {
        return this.state.get('data');
    }

    public get rowsPerPage() {
        return this.state.peekKey('rowsPerPage');
    }
    public set rowsPerPage(value: number) {
        this.applyRowsPerPage(value);
    }
    public get rowsPerPage$() {
        return this.state.get('rowsPerPage');
    }

    public get page() {
        return this.state.peekKey('page');
    }
    public set page(value: number) {
        this.applyPage(value);
    }
    public get page$() {
        return this.state.get('page');
    }

    public get sorting() {
        return this.state.peekKey('sorting');
    }
    public set sorting(value: IWarixArraySortDefinition[]) {
        this.applySorting(value);
    }
    public get sorting$() {
        return this.state.get('sorting');
    }

    public get multiSort() {
        return this.state.peekKey('multiSort');
    }
    public set multiSort(value: boolean) {
        this.applyMultiSort(value);
    }
    public get multiSort$() {
        return this.state.get('multiSort');
    }

    public get allowUnsort() {
        return this.state.peekKey('unsort');
    }
    public set allowUnsort(value: boolean) {
        this.applyAllowUnsort(value);
    }
    public get allowUnsort$() {
        return this.state.get('unsort');
    }

    public get grouping() {
        return this.state.peekKey('grouping');
    }
    public set grouping(value: string[]) {
        this.applyGrouping(...value);
    }
    public get grouping$() {
        return this.state.get('grouping');
    }

    public get filter() {
        return this.state.peekKey('filter');
    }
    public set filter(value: (item: T, index: number, array: T[]) => boolean) {
        this.applyFilter(value);
    }
    public get filter$() {
        return this.state.peekKey('filter');
    }

    public get hasGrouping$() {
        return this.state.map('grouping', x => isArray(x) && x.length > 0);
    }

    public get hasFilter$() {
        return this.state.map('filter', x => isFunction(x));
    }

    public get hasSorting$() {
        return this.state.map('sorting', x => isArray(x) && x.length > 0);
    }

    public get firstVisibleRecordIndex$() {
        return this.state.map('data', 'rowsPerPage', 'page', (a) => {
            if ((a[0] || []).length === 0) {
                return -1;
            }
            if (isNumber(a[1]) && isNumber(a[2])) {
                return a[1] * a[2];
            }
            return 0;
        });
    }

    public get firstVisibleRecord$() {
        return combineLatest(this.data$, this.firstVisibleRecordIndex$).pipe(map(x => x[0][x[1]]));
    }

    public get lastVisibleRecordIndex$() {
        return this.state.map('data', 'rowsPerPage', 'page', (a) => {
            if ((a[0] || []).length === 0) {
                return -1;
            }
            if (isNumber(a[1]) && isNumber(a[2])) {
                return a[1] * (a[2] + 1);
            }
            return a[0].length - 1;
        });
    }

    public get lastVisibleRecord$() {
        return combineLatest(this.data$, this.lastVisibleRecordIndex$).pipe(map(x => x[0][x[1]]));
    }

    public get maxPages$() {
        return this.state.map('data', 'rowsPerPage', x => this.determineMaxPages(x[0], x[1]));
    }

    constructor(initialData?: T[]) {
        this.state = new WarixDataSubject<IWarixDataSourceState<T>>({
            data: initialData || [],
            rowsPerPage: null,
            page: null,
            sorting: [],
            multiSort: true,
            unsort: true,
            grouping: [],
            filter: null
        });
        this.dataMapping = this.buildMappedSource();
    }

    private buildMappedSource() {
        return this.state.map('data', 'rowsPerPage', 'page', 'sorting', 'grouping', 'filter', (x) => {
            const sx = { data: x[0], rowsPerPage: x[1], page: x[2], sorting: x[3], grouping: x[4], filter: x[5] };
            let result = isFunction(sx.filter) ? (sx.data || []).filter(sx.filter) : (sx.data || []);
            if (isArray(sx.sorting) && sx.sorting.length > 0) {
                result = arrayMultiSort(result, sx.sorting).newValue;
            }
            if (isNumber(sx.rowsPerPage) && isNumber(sx.page)) {
                result = result.slice(sx.rowsPerPage * sx.page, sx.rowsPerPage * (sx.page + 1));
            }
            return isArray(sx.grouping) && sx.grouping.length > 0 ? arrayGroupBy(result, ...sx.grouping) : result;
        });
    }

    private determineMaxPages(data?: T[], rpp?: number) {
        const totalLength = (data || []).length;
        return totalLength === 0 ? 0 : !isNumber(rpp) ? 1 : Math.ceil(totalLength / rpp);
    }

    private coerceNumeric(value: number) {
        return !isNumber(value) ? null : Math.abs(Math.round(value));
    }

    private getSortingData() {
        return {
            sorting: this.state.peekKey('sorting') || [],
            unsort: !!this.state.peekKey('unsort'),
            multiSort: !!this.state.peekKey('multiSort')
        };
    }

    public complete() {
        this.state.complete();
    }

    /**
     * Sets the underlying data array, if needed, adjust the current page
     * @param value New data array
     */
    public applyData(value: T[]) {
        this.state.set('data', value);
        return this.applyRowsPerPage(this.state.peekKey('rowsPerPage'));
    }

    /**
     * Sets the underlying rows per page and adjust the page so that it is inside the max range in case its needed
     * @param value Rows per page
     */
    public applyRowsPerPage(value: number) {
        const rpp = this.coerceNumeric(value);
        const max = this.determineMaxPages(this.state.peekKey('data'), rpp);
        const cur = this.state.peekKey('page');
        this.state.patch({
            rowsPerPage: rpp,
            page: !isNumber(cur) ? null : cur > max ? max : cur
        });
        return this;
    }

    /**
     * Sets the underlying page value, constraining it so that it is in the allowed range
     * @param value Sero based page index
     */
    public applyPage(value: number) {
        const page = this.coerceNumeric(value);
        const max = this.determineMaxPages( this.state.peekKey('data'), this.state.peekKey('rowsPerPage'));
        this.state.set('page', !isNumber(value) ? value : value > max ? max : value );
        return this;
    }

    /**
     * @param rowsPerPage Rows per page
     * @param page Zero based page index
     */
    public applyPaging(rowsPerPage: number, page: number) {
        return this.applyRowsPerPage(rowsPerPage).applyPage(page);
    }

    /**
     * Clears all paging realated values
     */
    public clearPaging() {
        this.state.patch({ rowsPerPage: null, page: null });
        return this;
    }

    /**
     * Sets the underlying filtering function
     * @param value Filterning function, set to null to clear
     */
    public applyFilter(value: (item: T, index: number, array: T[]) => boolean) {
        this.state.set('filter', value);
        return this;
    }

    /**
     * Removes the current filtering function (if any)
     */
    public clearFilter() {
        return this.applyFilter(null);
    }

    /**
     * Sets the underlying sorting defintion array respecting the multiSort flag
     * @param value Sorting definition
     */
    public applySorting(value: IWarixArraySortDefinition[]) {
        const multiSortAllowed = this.state.peekKey('multiSort');
        const correctedValue = value || [];
        const nextValue = !multiSortAllowed && correctedValue.length > 1 ? correctedValue[0] : correctedValue;
        this.state.set('sorting', correctedValue);
        return this;
    }

    /**
     * Removes all sorting definitions (if any)
     */
    public clearSorting() {
        return this.applySorting([]);
    }

    /**
     * Sets the underlying multisort flag, adjusting the current sort definition if needed
     * @param value Multisort allowed
     */
    public applyMultiSort(value: boolean) {
        const currentSort = this.state.peekKey('sorting') || [];
        this.state.patch({
            multiSort: value,
            sorting: value === false && currentSort.length > 1 ? currentSort.slice(1) : currentSort
        });
        return this;
    }

    /**
     * When true, toggling a sort definition after descending order will remove it from the sort definition
     * @param value Allow unsort
     */
    public applyAllowUnsort(value: boolean) {
        this.state.set('unsort', !!value);
        return this;
    }

    /**
     * Sets the underlying groupBy definition
     * @param groupingProperties Array of properties to perform the grouping
     */
    public applyGrouping(...groupingProperties: string[]) {
        this.state.set('grouping', groupingProperties);
        return this;
    }

    /**
     * Removes all grouping definitions (if any)
     */
    public clearGrouping() {
        return this.applyGrouping(null);
    }

    /**
     * Toggles the sorting on a given propery
     * @param propertyName Sorting propertyname
     * @param addIfNotPresent When true, If the sort is not present in the current definition it is added (on multisort) or sort is set to it (if not multisort)
     */
    public toggleSort(propertyName: string, addIfNotPresent = true) {
        const sortData = this.getSortingData();
        const index = sortData.sorting.findIndex(x => x.property === propertyName);
        if (index > -1) {
            if (sortData.unsort && sortData.sorting[index].descending) {
                this.applySorting(arrayRemoveAt(sortData.sorting, index, 1).newValue);
            } else {
                this.applySorting(arraySetAt(sortData.sorting, index, { property: propertyName, descending: !sortData.sorting[index].descending }).newValue);
            }
        } else if (addIfNotPresent) {
            if (sortData.multiSort) {
                this.applySorting(arrayPush(sortData.sorting, { property: propertyName, descending: false }).newValue);
            } else {
                this.applySorting([{ property: propertyName, descending: false }]);
            }
        }
        return this;
    }

    /**
     * Remose the specified property from the sorting definition if present
     * @param propertyName Property name
     */
    public removeSort(propertyName: string) {
        const sortData = this.getSortingData();
        const index = sortData.sorting.findIndex(x => x.property === propertyName);
        if (index > -1) {
            this.applySorting(arrayRemoveAt(sortData.sorting, index, 1).newValue);
        }
        return this;
    }

    /**
     * Adds the given sort definition if its not already present, on multisort = false, replaces the current definition
     * @param propertyName Property name
     * @param descending Descending order?
     */
    public addSort(propertyName: string, descending: boolean) {
        const sortData = this.getSortingData();
        const index = sortData.sorting.findIndex(x => x.property === propertyName);
        if (index === -1) {
            if (sortData.multiSort) {
                this.applySorting(arrayPush(sortData.sorting || [], { property: propertyName, descending }).newValue);
            } else {
                this.applySorting([{ property: propertyName, descending }]);
            }
        } else {
            this.applySorting(arraySetAt(sortData.sorting, index, { property: propertyName, descending }).newValue);
        }
        return this;
    }

    /**
     * Adds the provided properties names to the grouping definition if not already present in the grouping defintion
     * @param propertyNames Properties names
     */
    public addGrouping(...propertyNames: string[]) {
        const current = this.state.peekKey('grouping') || [];
        const toAdd = propertyNames.filter(x => !current.includes(x));
        if (toAdd.length > 0) {
            this.applyGrouping(...arrayPush(current, ...toAdd).newValue);
        }
        return this;
    }

    /**
     * Removes the provided properties names from the grouping definition if present in the grouping defintion
     * @param propertyNames Properties names
     */
    public removeGrouping(...propertyNames: string[]) {
        this.applyGrouping(...arrayRemove(this.state.peekKey('grouping') || [], ...propertyNames).newValue);
        return this;
    }

    /**
     * If the provided property name is not present in the grouping definition it is added to it, otherwise, it is removed
     * @param propertyName Property name
     */
    public toggleGrouping(propertyName: string) {
        const current = this.state.peekKey('grouping') || [];
        return current.includes(propertyName) ? this.removeGrouping(propertyName) : this.addGrouping(propertyName);
    }

    /**
     * Determines if a sorting is applied by the given property
     * @param propertyName Property name
     */
    public isSortedBy(propertyName: string) {
        return this.sorting.findIndex(x => x.property === propertyName) > -1;
    }

    /**
     * Gets an observable that determines if a sorting is applied by the given property
     * @param propertyName Property name
     */
    public isSortedBy$(propertyName: string) {
        return this.state.map('sorting', a => a.findIndex(x => x.property === propertyName) > -1);
    }

    /**
     * Determines the sorting mode applied by the given property.
     * Where 0 = None, -1 = Descending, 1 = Ascending
     * @param propertyName Property name
     */
    public getSortModeOf(propertyName: string) {
        const found = this.sorting.find(x => x.property === propertyName);
        return !found ? WarixDataSourceSortMode.None : found.descending ? WarixDataSourceSortMode.Descending : WarixDataSourceSortMode.Ascending;
    }

    /**
     * Gets an observable that determines the sorting mode applied by the given property.
     * Where 0 = None, -1 = Descending, 1 = Ascending
     * @param propertyName Property name
     */
    public getSortModeOf$(propertyName: string) {
        return this.state.map('sorting', sorting => {
            const found = sorting.find(x => x.property === propertyName);
            return !found ? WarixDataSourceSortMode.None : found.descending ? WarixDataSourceSortMode.Descending : WarixDataSourceSortMode.Ascending;
        }).pipe(distinctUntilChanged());
    }

    /**
     * Determines if a grouping is applied by the given property
     * @param propertyName Property name
     */
    public isGroupedBy(propertyName: string) {
        return this.grouping.includes(propertyName);
    }

    /**
     * Gets an observable that determines if a grouping is applied by the given property
     * @param propertyName Property name
     */
    public isGroupedBy$(propertyName: string) {
        return this.state.map('grouping', x => x.includes(propertyName));
    }
}
