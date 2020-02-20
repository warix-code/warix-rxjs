import { Observable, race, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface IWarixManagedResult<T = any> {
    cancelled: boolean;
    data: T;
}

export interface IWarixRequestHandler {
    readonly cancellationToken: string;
    abort(): IWarixRequestHandler;
    managed<T>(request: Observable<T>): IWarixManagedResult<T>;
}

export class WarixRequestsManager {
    private readonly globalCancellToken: string;
    private terminator$: Subject<IWarixManagedResult<string>>;

    constructor() {
        this.globalCancellToken = Math.random().toString(36);
    }

    public cancellAll() {
        this.terminator$.next({ cancelled: true, data: this.globalCancellToken });
        return this;
    }

    public cancelSession(cancellationToken: string) {
        this.terminator$.next({ data: cancellationToken, cancelled: true });
        return this;
    }

    public complete() {
        this.cancellAll();
        this.terminator$.complete();
    }

    public session() {
        const cancellationToken = Math.random().toString(36);
        const canceller = this.terminator$.pipe(
            filter(x => x.data === cancellationToken || x.data === this.globalCancellToken),
            map(x => ({ cancelled: true, data: undefined }))
        );

        const ret = Object.defineProperties(Object.create(null), {
            cancellationToken: {
                get: () => cancellationToken,
                enumerable: true,
                configurable: false
            }
        });

        ret.managed = (request: Observable<any>) => {
            return race(
                canceller,
                request.pipe(map(x => ({ cancelled: false, data: x})))
            );
        };
        ret.abort = () => {
            this.terminator$.next({ data: cancellationToken, cancelled: true });
            return ret;
        };

        return Object.freeze(ret) as IWarixRequestHandler;
    }
}
