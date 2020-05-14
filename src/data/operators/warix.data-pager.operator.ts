import { isNil, times } from 'lodash';
import { combineLatest, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map, startWith, takeUntil } from 'rxjs/operators';
import { IWarixLocalDataSourcePagerItem } from '../warix.local-data-source';
import { WarixDataMap } from '../../warix.data-map';
import { WarixDataSubject } from '../../warix.data-subject';
import { isNotEmptyArray } from './common';

export class WarixDataSourcePagerOperator {
    private readonly state$: WarixDataSubject<{ rowsPerPage: number, page: number, dataLength: number }>;
    private readonly stateMap: WarixDataMap;
    private readonly terminator$: Subject<void>;

    public get dataLength() {
        return this.state$.peekKey('dataLength');
    }
    public set dataLength(value: number) {
        this.state$.set('dataLength', value);
    }
    public get dataLength$() {
        return this.stateMap.get<number>('dataLength');
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
            this.stateMap.set('inLastPage',
                combineLatest([
                    this.pagesCount$.pipe(startWith(this.pagesCount)),
                    this.page$.pipe(startWith(this.page))
                ]).pipe(
                    map(x => x[0] - 1 === (x[1] || 0)),
                    distinctUntilChanged()));
        }
        return this.stateMap.get<boolean>('inLastPage');
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

    public get page() {
        return this.state$.peekKey('page');
    }
    public set page(value: number) {
        this.paging(this.rowsPerPage, value);
    }
    public get page$() {
        return this.stateMap.get<number>('page');
    }

    public get pagerSourceArray() {
        return times(this.pagesCount, i => ({ value: i, display: i + 1 })) as IWarixLocalDataSourcePagerItem[];
    }
    public get pagerSourceArray$() {
        if (!this.stateMap.has('pagerSourceArray')) {
            this.stateMap.set('pagerSourceArray', this.pagesCount$.pipe(map(x => times(x, i => ({ value: i, display: i + 1 })))));
        }
        return this.stateMap.get<IWarixLocalDataSourcePagerItem[]>('pagerSourceArray');
    }

    public get pagesCount() {
        return this.calculatePagesCount(this.dataLength, this.rowsPerPage);
    }
    public get pagesCount$() {
        return this.stateMap.get<number>('pagesCount');
    }

    constructor(source: Observable<number>) {
        this.state$ = new WarixDataSubject<{ rowsPerPage: number, page: number, dataLength: number }>({
            dataLength: 0,
            page: null,
            rowsPerPage: null
        });
        this.stateMap = new WarixDataMap().liftFromDataSubject(this.state$);
        this.terminator$ = new Subject<void>();

        source.pipe(distinctUntilChanged(), takeUntil(this.terminator$)).subscribe(
            value => this.state$.set('dataLength', value),
            error => this.state$.error(error),
            () => this.state$.set('dataLength', 0)
        );
    }

    private calculatePagesCount(dataLength: number, rowsPerPage: number) {
        return (dataLength || 0) === 0 ? 0 : (rowsPerPage || 0) === 0 ? 1 : dataLength / rowsPerPage;
    }

    private paging(rowsPerPage: number, page: number) {
        const rpp = Math.round(Math.abs(rowsPerPage || 0));
        const ppp = Math.round(Math.abs(page || 0));
        const max = this.calculatePagesCount(this.dataLength, rpp);

        this.state$.patch({ rowsPerPage: isNil(rowsPerPage) ? rowsPerPage : rpp, page: isNil(page) ? page : ppp > max ? max : ppp });
        return this;
    }

    public apply<T>(dataSource: T[]) {
        if (isNotEmptyArray(dataSource) && !isNil(this.rowsPerPage) && !isNil(this.page)) {
            return dataSource.slice(this.rowsPerPage * this.page, this.rowsPerPage * (this.page + 1));
        }
        return dataSource;
    }

    public combine<T = any>(dataSource: Observable<T[]>) {
        return combineLatest([ dataSource, this.rowsPerPage$, this.page$ ]).pipe(map(x => this.apply(x[0])));
    }

    public complete() {
        this.terminator$.next();
        this.terminator$.complete();
        this.stateMap.complete();
        this.state$.complete();
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
