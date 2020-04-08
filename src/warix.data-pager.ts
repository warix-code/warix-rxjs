import { forkJoin, Observable, of } from 'rxjs';
import { take, tap, distinctUntilChanged } from 'rxjs/operators';
import { WarixDataSubject } from './warix.data-subject';
import { WarixDataMap } from './warix.data-map';

export type WarixDataPagerPageCallback<T = any> = (minIndex: number, maxIndex: number) => Observable<T[]>;

interface IWarixDataPagerPage<T = any> {
    index: number;
    data: T[];
}

interface IWarixDataPagerState<T> {
    loading: number;
    data: T[];
    eof: number;
}

export class WarixDataPager<T = any> {
    private readonly pages: IWarixDataPagerPage[] = [];
    private readonly state$: WarixDataSubject<IWarixDataPagerState<T>>;
    private readonly dataMap: WarixDataMap;

    private get loadingCount() {
        return this.state$.peekKey('loading');
    }

    private get eof() {
        return this.state$.peekKey('eof');
    }

    public get loading() {
        return this.state$.peekKey('loading') > 0;
    }
    public get loading$() {
        return this.dataMap.get<boolean>('loading');
    }

    public get eofReached() {
        return this.eof !== null;
    }
    public get eofReached$() {
        return this.dataMap.get<boolean>('eofReached');
    }

    public get data() {
        return this.state$.peekKey('data');
    }
    public get data$() {
        return this.dataMap.get<T[]>('data');
    }

    constructor(private readonly pageSize: number, private readonly pageCallback: WarixDataPagerPageCallback<T>) {
        this.state$ = new WarixDataSubject<IWarixDataPagerState<T>>({ loading: 0, data: null, eof: null });
        this.dataMap = new WarixDataMap();

        this.dataMap.set('loading', this.state$.map('loading', x => x > 0).pipe(distinctUntilChanged()));
        this.dataMap.set('eofReached', this.state$.map('eof', x => x !== null).pipe(distinctUntilChanged()));
        this.dataMap.set('data', this.state$.get('data'));
    }

    public static fromArray<M>(arraySource: M[], pageSize: number) {
        return new WarixDataPager(pageSize, (minIndex, maxIndex) => of(arraySource.slice(minIndex, maxIndex)));
    }

    private indexToPage(index: number) {
        return Math.floor(index / this.pageSize);
    }

    private createRequestObservable(pageIndex: number) {
        if (this.eof !== null) {
            if (this.eof <= pageIndex) {
                return of([]);
            } else {
                return this.pageCallback(pageIndex * this.pageSize, (pageIndex + 1) * this.pageSize)
                    .pipe(
                        take(1),
                        tap(result => {
                            if (result.length < this.pageSize) {
                                this.state$.set('eof', pageIndex);
                            }
                            this.pages.push({ data: result, index: pageIndex });
                        })
                    );
            }
        }
        return this.pageCallback(pageIndex * this.pageSize, (pageIndex + 1) * this.pageSize)
            .pipe(
                take(1),
                tap(result => {
                    if (result.length < this.pageSize) {
                        this.state$.set('eof', pageIndex);
                    }
                    this.pages.push({ data: result, index: pageIndex });
                })
            );
    }

    private requestPage(pageIndex: number, minIndex: number, maxIndex: number) {
        const sliceStart = minIndex - (pageIndex * this.pageSize);
        const sliceEnd = maxIndex - (pageIndex * this.pageSize);
        const dataPage = this.pages.find(pg => pg.index === pageIndex);
        if (dataPage) {
            this.state$.patch({ data: dataPage.data.slice(sliceStart, sliceEnd) });
        } else {
            this.state$.set('loading', this.loadingCount + 1);
            this.createRequestObservable(pageIndex)
                .subscribe(x => {
                    this.state$.patch({
                        loading: this.loadingCount - 1,
                        data: dataPage.data.slice(sliceStart, sliceEnd)
                    });
                });
        }
    }

    private requestMultiPage(minPageIndex: number, maxPageIndex: number, minIndex: number, maxIndex: number) {
        const foundMin = this.pages.find(pg => pg.index === minPageIndex);
        const foundMax = this.pages.find(pg => pg.index === maxPageIndex);

        if (foundMin && foundMax) {
            this.state$.patch({
                data: [
                    ...foundMin.data.slice(minIndex - (this.pageSize * minPageIndex)),
                    ...foundMax.data.slice(0, maxIndex - (this.pageSize * maxPageIndex))
                ]
            });
        } else {
            this.state$.set('loading', this.loadingCount + 1);
            forkJoin([
                foundMin ? of(foundMin.data) : this.createRequestObservable(minPageIndex),
                foundMax ? of(foundMax.data) : this.createRequestObservable(maxPageIndex)
            ]).subscribe((values: [T[], T[]]) => {
                this.state$.patch({
                    loading: this.loadingCount - 1,
                    data: [
                        ...values[0].slice(minIndex - (this.pageSize * minPageIndex)),
                        ...values[1].slice(0, maxIndex - (this.pageSize * maxPageIndex))
                    ]
                });
            });
        }
    }

    public complete() {
        this.pages.length = 0;
        this.dataMap.complete();
        this.state$.complete();
    }

    public request(minIndex: number, maxIndex: number) {
        const minPageIndex = this.indexToPage(minIndex);
        const maxPageIndex = this.indexToPage(maxIndex);
        if (minPageIndex === maxPageIndex) {
            this.requestPage(minPageIndex, minIndex, maxIndex);
        } else {
            this.requestMultiPage(minPageIndex, maxPageIndex, minIndex, maxIndex);
        }
        return this;
    }

    public reset() {
        this.pages.length = 0;
        this.state$.patch({ data: [], eof: null });
        return this;
    }
}