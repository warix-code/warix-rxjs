import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class WarixSubscriptionsManager {
    private readonly terminator$ = new Subject<void>();
    private readonly subsMap = new Map<any, Subscription[]>();

    public get taker() {
        return takeUntil(this.terminator$);
    }

    public complete() {
        this.unsubscribe();
        this.terminator$.next();
        this.terminator$.complete();
    }

    public addManaged(owner: any, ...subscriptions: Subscription[]) {
        if (!this.subsMap.has(owner)) {
            this.subsMap.set(owner, []);
        }
        this.subsMap.get(owner).push(...subscriptions);
        return this;
    }

    public unsubscribeFor(owner: any) {
        if (this.subsMap.has(owner)) {
            this.subsMap.get(owner).forEach(s => s.unsubscribe());
            this.subsMap.delete(owner);
        }
        return this;
    }

    public unsubscribe() {
        this.subsMap.forEach(v => v.forEach(s => s.unsubscribe()));
        this.subsMap.clear();
        return this;
    }
}
