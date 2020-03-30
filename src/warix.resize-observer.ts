import { combineLatest, fromEvent, Observable, Subject } from 'rxjs';
import { debounceTime, filter, map, startWith, takeUntil, tap } from 'rxjs/operators';
import { WarixResizeObserverEntry } from './support/warix.resize-observer-entry';

export interface IWarixResizeObserverHandler {
    readonly source$: Observable<WarixResizeObserverEntry>;
    readonly element: HTMLElement;
    complete(): void;
}

export class WarixResizeObserver {
    private readonly terminator$: Subject<void>;
    private readonly mutaDispatcher$: Subject<HTMLElement>;
    private readonly windowResize$: Observable<any>;
    private readonly handlers: IWarixResizeObserverHandler[] = [];
    private mutaObserver$: MutationObserver;

    constructor() {
        this.terminator$ = new Subject<void>();
        this.mutaDispatcher$ = new Subject<HTMLElement>();
        this.windowResize$ = fromEvent(window, 'resize').pipe(takeUntil(this.terminator$), debounceTime(20), startWith(null));
        this.mutaObserver$ = new MutationObserver((mutations, observer) => {
            mutations.forEach(m => this.mutaDispatcher$.next(m.target as HTMLElement));
        });
    }

    private disposeMutationObserver() {
        if (this.mutaObserver$) {
            this.mutaObserver$.disconnect();
            this.mutaObserver$ = null;
        }
    }

    private constructObservedElementHandlers(element: HTMLElement) {
        const elementTerminator$ =  new Subject<void>();
        const elementMutationObserver$ = this.mutaDispatcher$.pipe(
            takeUntil(elementTerminator$),
            filter(x => x === element),
            debounceTime(25),
            startWith(element)
        );
        const elementState = new WarixResizeObserverEntry(element);
        const resultObserver$ = combineLatest([ elementMutationObserver$, this.windowResize$.pipe(takeUntil(elementTerminator$)) ])
        .pipe(
            tap(x => elementState.update()),
            filter(x => elementState.hasChanges),
            map(x => elementState)
        );

        return {
            terminator: elementTerminator$,
            result: resultObserver$
        };
    }

    private completeAllHandlers() {
        while (this.handlers.length > 0) {
            this.handlers[0].complete();
        }
        return this;
    }

    public complete() {
        this.completeAllHandlers()
            .disposeMutationObserver();

        this.mutaDispatcher$.complete();
        this.terminator$.next();
        this.terminator$.complete();
    }

    public observe(element: HTMLElement) {
        const handlers = this.constructObservedElementHandlers(element);
        this.mutaObserver$.observe(element, { attributes: true, characterData: true, childList: true });

        const ret = Object.defineProperties(Object.create(null), {
            source$: {
                get: () => handlers.result,
                enumerable: true,
                configurable: false
            },
            element: {
                get: () => element,
                enumerable: true,
                configurable: false
            }
        });

        ret.complete = () => {
            handlers.terminator.next();
            handlers.terminator.complete();
            const index = this.handlers.indexOf(ret);
            if (index > -1) {
                this.handlers.splice(index, 1);
            }
        };

        this.handlers.push(ret);

        return Object.freeze(ret) as IWarixResizeObserverHandler;
    }
}