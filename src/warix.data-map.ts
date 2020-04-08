import { Observable } from 'rxjs';
import { WarixDataSubject } from './warix.data-subject';

export class WarixDataMap {
    private readonly map = new Map<string, Observable<any>>();

    public has(key: string) {
        return this.map.has(key);
    }

    public get<T = any>(key: string) {
        if (this.has(key)) {
            return this.map.get(key) as Observable<T>;
        }
        throw new Error(`WarixDataMapKeyNotException. Key ${ key } has not been mapped`);
    }

    public set(key: string, value: Observable<any>) {
        if (!this.has(key)) {
            this.map.set(key, value);
        }
        return this;
    }

    public forceSet(key: string, value: Observable<any>) {
        this.map.set(key, value);
        return this;
    }

    public liftFromDataSubject<T>(ds: WarixDataSubject<T>) {
        Object.keys(ds.getValue()).forEach(key => {
            this.set(key, ds.get(key as keyof T));
        });
        return this;
    }

    public remove(key: string) {
        if (this.has(key)) {
            this.map.delete(key);
        }
        return this;
    }

    public clear() {
        this.map.clear();
    }

    public complete() {
        this.clear();
    }
}