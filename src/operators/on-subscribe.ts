import { defer, Observable } from 'rxjs';

// SOURCE >> https://stackoverflow.com/a/48983284
export function onSubscribe<T>(action: () => void): (source: Observable<T>) =>  Observable<T> {
    return function inner(source: Observable<T>): Observable<T> {
        return defer(() => {
          action();
          return source;
        });
    };
}
