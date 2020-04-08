import { forkJoin, Observable, of } from 'rxjs';
import { distinctUntilChanged, take, tap } from 'rxjs/operators';
import { WarixDataMap } from './warix.data-map';
import { WarixDataSubject } from './warix.data-subject';

export type WarixDataPagerCallback<T = any> = (minIndex: number, maxIndex: number) => Observable<T[]>;

interface IWarixDataPagerPage<T = any> {
    pageIndex: number;
    startIndex: number;
    data: T[];
}

interface IWarixDataPagerState<T = any> {
    loadingCount: number;
    eofIndex: number;
    eofPage: number;
    minIndex: number;
    minPageIndex: number;
    maxPageIndex: number;
    maxIndex: number;
    lastRequestMinIndex: number;
    lastRequestMaxIndex: number;
    data: T[];
}

export class WarixDataPager<T = any> {
    private readonly state$: WarixDataSubject<IWarixDataPagerState<T>>;
    private readonly stateMap: WarixDataMap;
    private readonly pages: IWarixDataPagerPage<T>[] = [];

    /**
     * Gets the data that represents the last request issued on the pager
     */
    public get data() {
        return this.state$.peekKey('data');
    }
    /**
     * Gets an observable of the data that represents the last request issued on the pager
     */
    public get data$() {
        return this.stateMap.get<T[]>('data');
    }

    /**
     * Gets the last index the pager could retrieve when a request returned less than the pageSize of the pager
     */
    public get eofIndex() {
        return this.state$.peekKey('eofIndex');
    }
    /**
     * Gets an observable of the last index the pager could retrieve when a request returned less than the pageSize of the pager
     */
    public get eofIndex$() {
        return this.stateMap.get<number>('eofIndex');
    }

    /**
     * Gets the last page index the pager could retrieve when a request returned less than the pageSize of the pager
     */
    public get eofPage() {
        return this.state$.peekKey('eofPage');
    }
    /**
     * Gets an observable to the last page index the pager could retrieve when a request returned less than the pageSize of the pager
     */
    public get eofPage$() {
        return this.stateMap.get<number>('eofPage');
    }

    /**
     * Gets true when the pager issues a request that return a data set with less records than the pageSize
     */
    public get eof() {
        return this.state$.peekKey('eofIndex') !== null;
    }
    /**
     * Gets an observable that determines when the pager issues a request that return a data set with less records than the pageSize
     */
    public get eof$() {
        return this.stateMap.get<boolean>('eof');
    }

    /**
     * Gets the last maximum index requested to the pager
     */
    public get lastRequestMaxIndex() {
        return this.state$.peekKey('lastRequestMaxIndex');
    }
    /**
     * Gets an observable to the last maximum index requested to the pager
     */
    public get lastRequestMaxIndex$() {
        return this.stateMap.get<number>('lastRequestMaxIndex');
    }

    /**
     * Gets the last minimum index requested to the pager
     */
    public get lastRequestMinIndex() {
        return this.state$.peekKey('lastRequestMinIndex');
    }
    /**
     * Gets an observable to the last minimum index requested to the pager
     */
    public get lastRequestMinIndex$() {
        return this.stateMap.get<number>('lastRequestMinIndex');
    }

    /**
     * Gets true if the pager is waiting for data callback to complete
     */
    public get isLoading() {
        return this.state$.peekKey('loadingCount') > 0;
    }
    /**
     * Gets an observable that determines if pager is waiting for data callback to complete
     */
    public get isLoading$() {
        return this.stateMap.get<T[]>('isLoading');
    }

    /**
     * Gets the maximum record that exist in the pager data. (Might not be the eofIndex)
     */
    public get maxIndex() {
        return this.state$.peekKey('maxIndex');
    }
    /**
     * Gets an observable to the maximum record that exist in the pager data. (Might not be the eofIndex)
     */
    public get maxIndex$() {
        return this.stateMap.get<number>('maxIndex');
    }

    /**
     * Gets the minimum record that exist in the pager data. (Might not be the sofIndex)
     */
    public get minIndex() {
        return this.state$.peekKey('minIndex');
    }
    /**
     * Gets an oservable to the minimum record that exist in the pager data. (Might not be the sofIndex)
     */
    public get minIndex$() {
        return this.stateMap.get<number>('minIndex');
    }

    /**
     * Gets the maximum pageIndex that exist in the pager data. (Might not be the eofPageIndex)
     */
    public get maxPageIndex() {
        return this.state$.peekKey('maxPageIndex');
    }
    /**
     * Gets an observable to the maximum pageIndex that exist in the pager data. (Might not be the eofPageIndex)
     */
    public get maxPageIndex$() {
        return this.stateMap.get<number>('maxPageIndex');
    }

    /**
     * Gets the minimum pageIndex that exist in the pager data. (Might not be the sofPageIndex)
     */
    public get minPageIndex() {
        return this.state$.peekKey('minPageIndex');
    }
    /**
     * Gets an observable to the minimum pageIndex that exist in the pager data. (Might not be the sofPageIndex)
     */
    public get minPageIndex$() {
        return this.stateMap.get<number>('minPageIndex');
    }

    /**
     * Creates a new WarixDataPager
     * @param pageSize Page size per page request
     * @param callback Callback to retrieve information
     */
    constructor(public readonly pageSize: number, public readonly callback: WarixDataPagerCallback<T>) {
        this.state$ = new WarixDataSubject<IWarixDataPagerState<T>>({
            data: [],
            eofIndex: null,
            eofPage: null,
            lastRequestMaxIndex: null,
            lastRequestMinIndex: null,
            loadingCount: 0,
            maxIndex: null,
            maxPageIndex: null,
            minIndex: null,
            minPageIndex: null
        });
        this.stateMap = new WarixDataMap().liftFromDataSubject(this.state$);
        this.stateMap.set('isLoading', this.state$.map('loadingCount', x => x > 0).pipe(distinctUntilChanged()));
        this.stateMap.set('eof', this.state$.map('eofIndex', x => x !== null).pipe(distinctUntilChanged()));
    }

    private indexToPage(index: number) {
        return Math.floor(index / this.pageSize);
    }

    private determineRanges() {
        const pageIndexs = this.pages.map(x => x.pageIndex);
        const minPageIndex = Math.min(...pageIndexs);
        const maxPageIndex = Math.max(...pageIndexs);
        return {
            minIndex: minPageIndex * this.pageSize,
            maxIndex: (maxPageIndex * this.pageSize) + (this.pages.find(pg => pg.pageIndex === maxPageIndex).data.length),
            minPageIndex,
            maxPageIndex,
        };
    }

    private updateStateForPageRequest(pageIndex: number, dataLength: number) {
        const eofPage = this.state$.peekKey('eofPage');
        const eofIndex = this.state$.peekKey('eofIndex');
        const minPage = this.state$.peekKey('minPageIndex');
        const maxPage = this.state$.peekKey('maxPageIndex');
        const ranges = this.determineRanges();
        this.state$.patch({
            eofPage: eofPage !== null ? eofPage : dataLength < this.pageSize ? Math.min(pageIndex, eofPage) : eofPage,
            eofIndex: eofIndex !== null ? eofIndex : dataLength < this.pageSize ? Math.min(eofIndex, ranges.maxIndex) : eofIndex,
            minPageIndex: ranges.minPageIndex,
            maxPageIndex: ranges.maxPageIndex,
            minIndex: ranges.minIndex,
            maxIndex: ranges.maxIndex,
            loadingCount: this.state$.peekKey('loadingCount') - 1
        });
    }

    /**
     * Determine if the page is allowed to be requested with respect of the detected EOF if any
     * @param pageIndex Requested page index
     */
    private allowPageRequest(pageIndex: number) {
        const currentEOFPage = this.state$.peekKey('eofPage');
        return currentEOFPage === null ? true : pageIndex < currentEOFPage;
    }

    /**
     * Obtains a single page from the pages buffer or from a new callback request and updates the underlying state accordingly
     * @param pageIndex Page requested
     */
    private getPage(pageIndex: number) {
        if (!this.allowPageRequest(pageIndex)) {
            return of([]);
        }
        const page = this.pages.find(pg => pg.pageIndex === pageIndex);
        if (page) {
            return of(page.data);
        } else {
            this.state$.set('loadingCount', this.state$.peekKey('loadingCount') + 1);
            return this.callback(pageIndex * this.pageSize, (pageIndex + 1) * this.pageSize)
            .pipe(
                take(1),
                tap(dataResults => {
                    const dr = dataResults || [];
                    this.pages.push({ data: dr, pageIndex, startIndex: pageIndex * this.pageSize });
                    this.updateStateForPageRequest(pageIndex, dr.length);
                })
            );
        }
    }

    private pageDataSlice(data: T[], minIndex: number, maxIndex: number, pageIndex: number) {
        return data.slice(
            minIndex - (pageIndex * this.pageSize),
            maxIndex - (pageIndex * this.pageSize)
        );
    }

    private multiPageDataSlice(dataArrays: T[][], minIndex: number, maxIndex: number, minPageIndex: number, maxPageIndex: number) {
        const first = dataArrays[0];
        const last = dataArrays[ dataArrays.length - 1];
        const middle: T[] = [];
        for (let i = 1; i < dataArrays.length - 1; i++) {
            middle.push(...dataArrays[i]);
        }
        return [
            ...first.slice(minIndex - (minPageIndex * this.pageSize)),
            ...middle,
            ...last.slice(0, maxIndex - (maxPageIndex * this.pageSize))
        ];
    }

    /**
     * Completes the underlying observable state and mappings
     */
    public complete() {
        this.pages.length = 0;
        this.stateMap.complete();
        this.state$.complete();
    }

    /**
     * Request a record set delimeted by its range indexs
     * @param minIndex Min record index
     * @param maxIndex Max record index
     */
    public request(minIndex: number, maxIndex: number) {
        const minPageIndex = this.indexToPage(Math.min(minIndex, maxIndex));
        const maxPageIndex = this.indexToPage(Math.max(maxIndex, minIndex));

        if (minPageIndex === maxPageIndex) {
            this.getPage(minPageIndex).subscribe(x => {
                this.state$.patch({
                    data: this.pageDataSlice(x, minIndex, maxIndex, minPageIndex),
                    lastRequestMaxIndex: maxIndex,
                    lastRequestMinIndex: minIndex
                });
            });
        } else {
            const pagesRequests: Observable<T[]>[] = [];
            for (let i = minPageIndex; i <= maxPageIndex; i++) {
                pagesRequests.push(this.getPage(i));
            }
            forkJoin(pagesRequests).subscribe((values) => {
                this.state$.patch({
                    data: this.multiPageDataSlice(values, minIndex, maxIndex, minPageIndex, maxPageIndex),
                    lastRequestMaxIndex: maxIndex,
                    lastRequestMinIndex: minIndex
                });
            });
        }
        return this;
    }

    /**
     * Requests a single record
     * @param recordIndex Record index
     */
    public requestRecord(recordIndex: number) {
        return this.request(recordIndex, recordIndex);
    }

    /**
     * Requests a record set delimited by the range than encompass the given page
     * @param pageIndex Index of the page
     */
    public requestPage(pageIndex: number) {
        return this.request(pageIndex * this.pageSize, (pageIndex + 1) * this.pageSize);
    }

    /**
     * Resets the pager to its initial state
     */
    public reset() {
        this.pages.length = 0;
        this.state$.next({
            data: [],
            eofIndex: null,
            eofPage: null,
            lastRequestMaxIndex: null,
            lastRequestMinIndex: null,
            loadingCount: 0,
            maxIndex: null,
            maxPageIndex: null,
            minIndex: null,
            minPageIndex: null
        });
        return this;
    }
}
