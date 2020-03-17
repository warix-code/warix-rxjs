import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { arraySetAt } from './warix.array-operations';
import { WarixDataSubject } from './warix.data-subject';

export type WarixGridSubjectActivator<T> = (column: number, row: number, index: number) => T;
export type WarixGridSubjectProcessor<T> = (column: number, row: number, index: number, value: T) => T;

export class WarixGridSubject<T> extends BehaviorSubject<T[]> {
    private state$: WarixDataSubject<{ colCount: number, rowCount: number }>;
    private afterOperationBacker: WarixGridSubjectProcessor<T>;

    /**
     * Total length of the underlying array
     */
    public get length() {
        return this.getValue().length;
    }
    /**
     * Observable to the total length of the underlying array
     */
    public get length$() {
        return this.pipe(map(x => x.length), distinctUntilChanged());
    }

    /**
     * Number of columns of the grid
     */
    public get columns() {
        return this.state$.peekKey('colCount');
    }
    /**
     * Observable to the number of columns of the grid
     */
    public get columns$() {
        return this.state$.get('colCount');
    }

    /**
     * Number of rows of the grid
     */
    public get rows() {
        return this.state$.peekKey('rowCount');
    }
    /**
     * Observable to the number of rows of the grid
     */
    public get rows$() {
        return this.state$.get('rowCount');
    }

    /**
     * Initializes a new WarixGridSubject<T>
     * @param columns Initial number of columns
     * @param rows Initial number of rows
     * @param activator Function used to determine the value for new cells
     */
    constructor(columns: number, rows: number, public activator: WarixGridSubjectActivator<T>) {
        super([]);
        this.state$ = new WarixDataSubject({ colCount: columns, rowCount: rows });
        this.fill(columns, rows);
    }

    private coordsToGridIndex(x: number, y: number, colCount: number, rowCount: number) {
        if (x >= 0 && x < colCount && y >= 0 && y < rowCount) {
            return (y * colCount) + x;
        }
        return -1;
    }

    private indexToGridCoords(index: number, colCount: number, rowCount: number) {
        if (index >= 0 && index < colCount * rowCount) {
            const y = Math.floor(index / colCount);
            return {
                x: index - (y * colCount),
                y
            };
        }
        return { x: -1, y: -1 };
    }

    private valueForNewCell(x: number, y: number, i: number) {
        return this.activator ? this.activator(x, y, i) : null;
    }

    private mapColumn(index: number, array: T[]) {
        if (index >= 0 && index < this.columns) {
            const column: T[] = [];
            for (let i = 0; i < this.rows; i++) {
                column.push(array[ this.coordsToIndex(index, i) ]);
            }
            return column;
        }
        return null;
    }

    private mapRow(index: number, array: T[]) {
        if (index >= 0 && index < this.rows) {
            const column: T[] = [];
            for (let i = 0; i < this.columns; i++) {
                column.push(array[ this.coordsToIndex(i, index) ]);
            }
            return column;
        }
        return null;
    }

    private mapBidimensional(array: T[]) {
        const ret: T[][] = [];
        for (let i = 0; i < this.rows; i++) {
            ret.push(this.mapRow(i, array));
        }
        return ret;
    }

    private applyNext(next: T[]) {
        if (this.afterOperationBacker) {
            const nextMapped: T[] = [];
            for (let i = 0; i < next.length; i++) {
                const coords = this.indexToGridCoords(i, this.columns, this.rows);
                nextMapped.push(this.afterOperationBacker(coords.x, coords.y, i, next[i]));
            }
            this.next(nextMapped);
        } else {
            this.next(next);
        }
    }

    /**
     * Coonverts a global index to coords on the grid of the form {x: number, y: number}
     * @param index Global index
     */
    public indexToCoords(index: number) {
        if (index >= 0 && index < this.length) {
            const y = Math.floor(index / this.columns);
            return {
                x: index - (y * this.columns),
                y
            };
        }
        return { x: -1, y: -1 };
    }

    /**
     * Converts the provided column and row to its equivalent global index
     * @param x Column number
     * @param y Row number
     */
    public coordsToIndex(x: number, y: number) {
        if (x >= 0 && x < this.columns && y >= 0 && y < this.rows) {
            return (y * this.columns) + x;
        }
        return -1;
    }

    public complete() {
        this.state$.complete();
        super.complete();
    }

    /**
     * Registers an operation that will be applied to the underlying array after any of the operations (push/pop/shift/unshift/insert/remove).
     * Useful to normalize without re issuing a next operation
     * @param handler Operation
     */
    public afterOperation(handler: WarixGridSubjectProcessor<T>) {
        this.afterOperationBacker = handler;
        return this;
    }

    /**
     * Obtains an observable to the value of the cell at the given global index
     * @param index Global index of the cell
     */
    public get(index: number): Observable<T>;
    /**
     * Obtains an observable to the value of the cell at the given coordinates
     * @param x Column number
     * @param y Row number
     */
    public get(x: number, y: number): Observable<T>;
    public get() {
        if (arguments.length === 1) {
            return this.pipe(map(x => x[arguments[0]]), distinctUntilChanged());
        } else if (arguments.length === 2) {
            return this.pipe(map(x => x[ this.coordsToIndex(arguments[0], arguments[1]) ]), distinctUntilChanged());
        }
        return undefined;
    }

    /**
     * Sets the value of the cell at the given global index
     * @param index Global index of the cell
     * @param value New value for the cell
     */
    public set(index: number, value: T): this;
    /**
     * Sets the value of the cell at the given coordinates
     * @param x Column number
     * @param y Row number
     * @param value New value for the cell
     */
    public set(x: number, y: number, value: T): this;
    public set() {
        if (arguments.length === 2) {
            this.next(arraySetAt(this.getValue(), arguments[0], arguments[1]).newValue);
        } else if (arguments.length === 3) {
            this.next(arraySetAt(this.getValue(), this.coordsToIndex(arguments[0], arguments[1]), arguments[2]).newValue);
        }
        return this;
    }

    /**
     * Obtains an array of the values at the given column
     * @param index Column index
     */
    public getColumn(index: number) {
        return this.mapColumn(index, this.getValue());
    }

    /**
     * Obtains an observable array of the values at the given column
     * @param index Column index
     */
    public getColumn$(index: number) {
        return this.pipe(map(x => this.mapColumn(index, x)));
    }

    /**
     * Obtains an array of the values at the given row
     * @param index Row index
     */
    public getRow(index: number) {
        return this.mapRow(index, this.getValue());
    }

    /**
     * Obtains an observable array of the values at the given row
     * @param index Row index
     */
    public getRow$(index: number) {
        return this.pipe(map(x => this.mapRow(index, x)));
    }

    /**
     * Obtains the value of the cell at the given global index
     * @param index Global index of the cell
     */
    public peekKey(index: number): T;
    /**
     * Obtains the value of the cell at the given coordinates
     * @param x Column number
     * @param y Row number
     */
    public peekKey(x: number, y: number): T;
    public peekKey() {
        if (arguments.length === 1) {
            return this.getValue()[ arguments[0] ];
        } else if (arguments.length === 2) {
            return this.getValue()[ this.coordsToIndex(arguments[0], arguments[1]) ];
        }
        return undefined;
    }

    /**
     * Clears the underlying an array and recreates it for the given number of columns and rows
     * @param columns Number of columns
     * @param rows Number of rows
     */
    public fill(columns: number, rows: number) {
        this.state$.patch({ colCount: columns, rowCount: rows });

        const next: T[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                next.push(this.valueForNewCell(c, r, this.coordsToIndex(c, r)));
            }
        }
        this.next(next);
    }

    /**
     * Adds a column at the end
     */
    public pushColumn() {
        const next: T[] = [];
        for (let i = 0; i < this.rows; i++) {
            next.push(
                ...this.getRow(i),
                this.valueForNewCell(
                    this.columns,
                    i,
                    this.coordsToGridIndex(this.columns, i, this.columns + 1, this.rows)
                )
            );
        }
        this.state$.set('colCount', this.columns + 1);
        this.applyNext(next);
        return this;
    }

    /**
     * Adds a row at the end
     */
    public pushRow() {
        const next: T[] = [ ...this.getValue() ];
        for (let i = 0; i < this.columns; i++) {
            next.push(this.valueForNewCell(i, this.rows, this.coordsToGridIndex(i, this.rows, this.columns, this.rows + 1)));
        }
        this.state$.set('rowCount', this.rows + 1);
        this.applyNext(next);
        return this;
    }

    /**
     * Removes the last column
     */
    public popColumn() {
        if (this.length > 0) {
            const next: T[] = [];
            for (let i = 0; i < this.rows; i++) {
                next.push(...this.getRow(i).slice(0, this.columns - 1));
            }
            this.state$.set('colCount', this.columns - 1);
            this.applyNext(next);
        }
        return this;
    }

    /**
     * Removes the last row
     */
    public popRow() {
        if (this.length > 0) {
            this.state$.set('rowCount', this.rows - 1);
            this.applyNext(this.getValue().slice(0, this.length - this.columns));
        }
        return this;
    }

    /**
     * Removes the first column
     */
    public shiftColumn() {
        if (this.length > 0) {
            const next: T[] = [];
            for (let i = 0; i < this.rows; i++) {
                next.push(...this.getRow(i).slice(1));
            }
            this.state$.set('colCount', this.columns - 1);
            this.applyNext(next);
        }
        return this;
    }

    /**
     * Removes the first row
     */
    public shiftRow() {
        if (this.length > 0) {
            this.state$.set('rowCount', this.rows - 1);
            this.applyNext(this.getValue().slice(this.columns));
        }
        return this;
    }

    /**
     * Adds a column at the start
     */
    public unshiftColumn() {
        const next: T[] = [];
        for (let i = 0; i < this.rows; i++) {
            next.push(
                this.valueForNewCell(0, i, this.coordsToGridIndex(0, i, this.columns + 1, this.rows)),
                ...this.getRow(i)
            );
        }
        this.state$.set('colCount', this.columns + 1);
        this.applyNext(next);
        return this;
    }

    /**
     * Adds a row at the start
     */
    public unshiftRow() {
        const next: T[] = [ ];
        for (let i = 0; i < this.columns; i++) {
            next.push(this.valueForNewCell(i, 0, this.coordsToGridIndex(i, 0, this.columns, this.rows + 1)));
        }
        next.push(...this.getValue());
        this.state$.set('rowCount', this.rows + 1);
        this.applyNext(next);
        return this;
    }

    /**
     * Inserts a column at the given index
     * @param index Index
     */
    public insertColumn(index: number) {
        if (index >= 0 && index < this.columns) {
            const next: T[] = [];
            for (let i = 0; i < this.rows; i++) {
                const row = this.getRow(i);
                row.splice(index, 0, this.valueForNewCell(index, i, this.coordsToGridIndex(index, i, this.columns + 1, this.rows)));
                next.push(...row);
            }
            this.state$.set('colCount', this.columns + 1);
            this.applyNext(next);
        }
        return this;
    }

    /**
     * Inserts a row at the given index
     * @param index Index
     */
    public insertRow(index: number) {
        if (index >= 0 && index < this.rows) {
            const newRow: T[] = [];
            const next: T[] = [];
            for (let i = 0; i < this.columns; i++) {
                newRow.push(this.valueForNewCell(i, index, this.coordsToGridIndex(i, index, this.columns, this.rows + 1)));
            }
            for (let i = 0; i < this.rows; i++) {
                if (i === index) {
                    next.push(...newRow);
                }
                next.push(...this.getRow(i));
            }
            this.state$.set('rowCount', this.rows + 1);
            this.applyNext(next);
        }
        return this;
    }

    /**
     * Removes the column at the given index
     * @param index Index
     */
    public removeColumn(index: number) {
        if (index >= 0 && index < this.columns) {
            const next: T[] = [];
            for (let i = 0; i < this.rows; i++) {
                const row = this.getRow(i);
                row.splice(index, 1);
                next.push(...row);
            }
            this.state$.set('colCount', this.columns - 1);
            this.applyNext(next);
        }
        return this;
    }

    /**
     * Removes the row at the given index
     * @param index Index
     */
    public removeRow(index: number) {
        if (index >= 0 && index < this.rows) {
            const next: T[] = [];
            for (let i = 0; i < this.rows; i++) {
                if (i !== index) {
                    next.push(...this.getRow(i));
                }
            }
            this.state$.set('rowCount', this.rows + 1);
            this.applyNext(next);
        }
        return this;
    }

    /**
     * Iterates over the grid applying the provided function to resolve the new value of each cell
     * @param action Action to apply to each cell to resolve its new value
     */
    public apply(action: WarixGridSubjectProcessor<T>) {
        const next: T[] = [];
        const current = this.getValue();
        for (let i = 0; i < current.length; i++) {
            const coords = this.indexToCoords(i);
            next.push(action(coords.x, coords.y, i, current[i]));
        }
        this.next(next);
        return this;
    }

    /**
     * Clears the underlying array, setting columns = 0 and rows = 0
     */
    public clear() {
        this.state$.patch({ colCount: 0, rowCount: 0 });
        this.next([]);
        return this;
    }

    /**
     * Obtains the bi dimensional array representation of the grid
     */
    public toBidimensionalArray() {
        return this.mapBidimensional(this.getValue());
    }

    /**
     * Obtains an observable the bi dimensional array representation of the grid
     */
    public toBidimensionalArray$() {
        return this.pipe(map(x => this.mapBidimensional(x)));
    }
}
