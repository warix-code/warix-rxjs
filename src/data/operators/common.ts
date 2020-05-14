export const isEmptyArray = (array: any[]) => (array || []).length === 0;

export const isNotEmptyArray = (array: any[]) => !isEmptyArray(array);
