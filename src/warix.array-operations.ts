export interface IWarixArrayItemChange<T> {
    index: number;
    item: T;
}

export interface IWarixArrayShiftChange<T> {
    oldIndex: number;
    newIndex: number;
    item: T;
}

export interface IWarixArrayOperationChange<T> {
    oldValue: T[];
    newValue: T[];
    addedItems: IWarixArrayItemChange<T>[];
    removedItems: IWarixArrayItemChange<T>[];
    shiftedItems: IWarixArrayShiftChange<T>[];
}

export interface IWarixArrayGrouping<T> {
    groupedBy: string;
    groupedByValue: any;
    items: T[] | IWarixArrayGrouping<T>[];
}

const fnNoAction = <T>(baseArray: T) => {
    return {
        oldValue: baseArray,
        newValue: baseArray,
        addedItems: [],
        removedItems: [],
        shiftedItems: []
    };
};

const fnShuffle = <T>(array: T[]) => {
    let counter = array.length;
    while (counter > 0) {
        const index = Math.floor(Math.random() * counter);
        counter--;
        const temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }
    return array;
};

export const arrayPush = <T>(baseArray: T[], ...items: T[]): IWarixArrayOperationChange<T> => {
    if (items.length === 0) {
        return fnNoAction(baseArray);
    }
    return {
        oldValue: baseArray,
        newValue: [ ...baseArray, ...items ],
        addedItems: items.map((item, index) => ({ item, index: index + baseArray.length })),
        removedItems: [],
        shiftedItems: []
    };
};

export const arrayPop = <T>(baseArray: T[]): IWarixArrayOperationChange<T> => {
    if (baseArray.length === 0) {
        return fnNoAction(baseArray);
    }
    const removed = { index: baseArray.length - 1, item: baseArray[baseArray.length - 1] };
    return {
        oldValue: baseArray,
        newValue: baseArray.slice(0, baseArray.length - 1),
        addedItems: [],
        removedItems: [ removed ],
        shiftedItems: []
    };
};

export const arrayShift = <T>(baseArray: T[]): IWarixArrayOperationChange<T> => {
    if (baseArray.length === 0) {
        return fnNoAction(baseArray);
    }
    const removed = { index: 0, item: baseArray[0] };
    const newValue = baseArray.slice(1);
    return {
        oldValue: baseArray,
        newValue,
        addedItems: [],
        removedItems: [ removed ],
        shiftedItems: newValue.map((item, i) => ({ oldIndex: i - 1, newIndex: i, item }))
    };
};

export const arrayUnshift = <T>(baseArray: T[], ...items: T[]): IWarixArrayOperationChange<T> => {
    if (items.length === 0) {
        return fnNoAction(baseArray);
    }

    const newValue = [ ...items, ...baseArray ];
    return {
        oldValue: baseArray,
        newValue,
        addedItems: items.map((item, index) => ({ item, index })),
        removedItems: [],
        shiftedItems: baseArray.map((item, oldIndex) => ({ oldIndex, newIndex: oldIndex + items.length, item }))
    };
};

export const arraySplice = <T>(baseArray: T[], start: number, deleteCount = 0, ...items: T[]): IWarixArrayOperationChange<T> => {
    const mappedClone = baseArray.slice(0).map((item, index) => ({ oldIndex: index, newIndex: index, item }));
    const removedClone = mappedClone.splice(start, deleteCount, ...items.map(item => ({ oldIndex: -1, newIndex: -1, item })));
    mappedClone.forEach((item, index) => item.newIndex = index);

    return {
        oldValue: baseArray,
        newValue: mappedClone.map(x => x.item),
        addedItems: mappedClone.filter(x => x.oldIndex === -1).map(x => ({ index: x.newIndex, item: x.item })),
        removedItems: removedClone.map(x => ({ index: x.oldIndex, item: x.item })),
        shiftedItems: mappedClone.filter(x => x.oldIndex !== x.newIndex && x.oldIndex > -1)
    };
};

export const arrayInsert = <T>(baseArray: T[], index: number, ...items: T[]): IWarixArrayOperationChange<T> => {
    if (items.length === 0) {
        return fnNoAction(baseArray);
    }
    return arraySplice(baseArray, index, 0, ...items);
};

export const arrayRemoveAt = <T>(baseArray: T[], index: number, removeCount = 1): IWarixArrayOperationChange<T> => {
    if (removeCount <= 0) {
        return fnNoAction(baseArray);
    }
    return arraySplice(baseArray, index, removeCount);
};

export const arrayRemoveWhere = <T>(baseArray: T[], condition: (value: T, index?: number, source?: T[]) => boolean): IWarixArrayOperationChange<T> => {
    const allMapped = baseArray.map((item, oldIndex) => ({ oldIndex, newIndex: oldIndex, item, remove: condition(item, oldIndex, baseArray) }));
    const removedItems = allMapped.filter(x => x.remove).map(x => ({ item: x.item, index: x.oldIndex }));
    const result = allMapped.filter(x => x.remove === false);

    result.forEach((x, index) => x.newIndex = index);

    return {
        oldValue: baseArray,
        newValue: result.map(x => x.item),
        addedItems: [],
        removedItems,
        shiftedItems: allMapped.filter(x => x.oldIndex !== x.newIndex).map(x => ({ oldIndex: x.oldIndex, newIndex: x.newIndex, item: x.item }))
    };
};

export const arrayRemove = <T>(baseArray: T[], ...items: T[]) => arrayRemoveWhere(baseArray, i => items.indexOf(i) > -1);

export const arraySort = <T>(baseArray: T[], compareFn?: (a: T, b: T) => number): IWarixArrayOperationChange<T> => {
    const mapped = baseArray.map((item, oldIndex) => ({ oldIndex, newIndex: oldIndex, item })).sort((a, b) => {
        return compareFn ? compareFn(a.item, b.item) : (a.item < b.item ? -1 : a.item === b.item ? 0 : 1);
    });
    return {
        oldValue: baseArray,
        newValue: mapped.map(x => x.item),
        addedItems: [],
        removedItems: [],
        shiftedItems: mapped.filter(x => x.newIndex !== x.oldIndex)
    };
};

export const arraySet = <T>(baseArray: T[], newValue: T[]): IWarixArrayOperationChange<T> => {
    return {
        oldValue: baseArray,
        newValue,
        addedItems: newValue.map((item, index) => ({ item, index })),
        removedItems: baseArray.map((item, index) => ({ item, index })),
        shiftedItems: []
    };
};

export const arraySetAt = <T>(baseArray: T[], index: number, value: T) => arraySplice(baseArray, index, 1, value);

export const arrayRevese = <T>(baseArray: T[]): IWarixArrayOperationChange<T> => {
    const newValue = baseArray.map((item, index) => ({ oldIndex: index, newIndex: index, item })).reverse();
    newValue.forEach((x, i) => x.newIndex = i);
    return {
        oldValue: baseArray,
        newValue: newValue.map(x => x.item),
        addedItems: [],
        removedItems: [],
        shiftedItems: newValue.filter(x => x.oldIndex !== x.newIndex)
    };
};

export const arrayShuffle = <T>(baseArray: T[]): IWarixArrayOperationChange<T> => {
    const mapped = fnShuffle(baseArray.map((item, oldIndex) => ({ oldIndex, newIndex: oldIndex, item })));
    mapped.forEach((x, index) => x.newIndex = index);
    return {
        oldValue: baseArray,
        newValue: mapped.map(x => x.item),
        addedItems: [],
        removedItems: [],
        shiftedItems: mapped.filter(x => x.newIndex !== x.oldIndex)
    };
};

export const arrayDistinct = <T>(baseArray: T[]) => arrayRemoveWhere(baseArray, (value, index, array) => array.indexOf(value) !== index);

export const arrayGroupBy = <T>(baseArray: T[], ...groupByPropertiesNames: string[]) => {

    const fnApplyGrouping = (ax: T[], prop: string, nextProps: string[]) => {
        return arrayDistinct(ax.map(i => i[prop])).newValue.map(distinctValueEntry => {
            const applicableItems = ax.filter(i => i[prop] === distinctValueEntry);
            const ret: IWarixArrayGrouping<T> = {
                groupedBy: prop,
                groupedByValue: distinctValueEntry,
                items: nextProps.length === 0 ? applicableItems : fnApplyGrouping(applicableItems, nextProps[0], nextProps.slice(1))
            };
            return ret;
        });
    };

    return (baseArray || []).length === 0 || (groupByPropertiesNames || []).length === 0 ?
        [ { groupedBy: null, groupedByValue: null, items: baseArray } ] as IWarixArrayGrouping<T>[] :
        fnApplyGrouping(baseArray, groupByPropertiesNames[0], groupByPropertiesNames.slice(1));
};
