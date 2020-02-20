import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { pluck, distinctUntilChanged, map } from 'rxjs/operators';

const empty = () => Object.create(null);

export class WarixDataSubject<T extends {}> extends BehaviorSubject<T> {
    public key<M extends keyof T>(key: M): Observable<T[M]>;
    public key<M extends keyof T>(key: M, value: T[M]): this;
    public key() {
        if (arguments.length === 2) {
            this.next(Object.assign(empty(), this.value, { [arguments[0]]: arguments[1] }));
            return this;
        }
        return this.pipe(pluck(arguments[0]), distinctUntilChanged());
    }

    public compound<A extends keyof T, B extends keyof T>(a: A, b: B): Observable<[T[A], T[B]]>;
    public compound<A extends keyof T, B extends keyof T, C extends keyof T>(a: A, b: B, c: C): Observable<[T[A], T[B], T[C]]>;
    public compound<A extends keyof T, B extends keyof T, C extends keyof T, D extends keyof T>(a: A, b: B, c: C, d: D): Observable<[T[A], T[B], T[C], T[D]]>;
    public compound<A extends keyof T, B extends keyof T, C extends keyof T, D extends keyof T, E extends keyof T>(a: A, b: B, c: C, d: D, e: E): Observable<[T[A], T[B], T[C], T[D], T[E]]>;
    public compound() {
        return combineLatest(Array.from(arguments).map(x => this.key(x)));
    }

    public map<A extends keyof T, M>(a: A, mapping: (value: T[A]) => M): Observable<M>;
    public map<A extends keyof T, B extends keyof T, M>(a: A, b: B, mapping: (values: [ T[A], T[B] ]) => M): Observable<M>;
    public map<A extends keyof T, B extends keyof T, C extends keyof T, M>(a: A, b: B, c: C, mapping: (values: [ T[A], T[B], T[C] ]) => M): Observable<M>;
    public map<A extends keyof T, B extends keyof T, C extends keyof T, D extends keyof T, M>(a: A, b: B, c: C, d: D, mapping: (values: [ T[A], T[B], T[C], T[D] ]) => M): Observable<M>;
    public map<A extends keyof T, B extends keyof T, C extends keyof T, D extends keyof T, E extends keyof T, M>(a: A, b: B, c: C, d: D, e: E, mapping: (values: [ T[A], T[B], T[C], T[D], T[E] ]) => M): Observable<M>;
    public map() {
        const keys = Array.from(arguments);
        const mapping = keys.pop();
        if (keys.length === 1) {
            return this.key(keys[0]).pipe(map(x => mapping(x)));
        }
        return combineLatest(keys.map(x => this.key(x))).pipe(map(x => mapping(x)));
    }

    public peekKey<M extends keyof T>(key: M) {
        return this.value[key];
    }

    public patch(value: Partial<T>) {
        this.next(Object.assign(empty(), this.value, value));
        return this;
    }
}
