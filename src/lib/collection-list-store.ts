import { useMemo } from "react";
import {
  addToCollection,
  collectionContains,
  createCollection,
  createCollectionWithItems,
  deleteCollection,
  deleteCollectionWithResult,
  moveBetweenCollections,
  readCollections,
  readPersistedCollectionSnapshot,
  removeCollectionMembership,
  removeFromCollection,
  renameCollection,
  renameCollectionWithResult,
  reorderCollectionItems,
  setCollectionDescription,
  setCollectionMembership,
  subscribeCollections,
  toggleInCollection,
  updateCollectionItem,
  useCollection,
  useCollections,
  useCollectionsContaining,
  type Collection,
} from "./collections";
import type { CustomList, ListStore } from "./custom-lists";

/**
 * The user's lists are collections. Everything that took the shared list store
 * (the "Add to list" menus, Home's list rows, the profile showcase, Big
 * Picture) reads and writes collections through it. Manga keeps a list store
 * of its own.
 */
function asList(collection: Collection): CustomList {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    coverImage: collection.coverImage,
    bgImage: collection.bgImage,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    items: collection.items.map((item) => ({ ...item, addedAt: item.addedAt ?? 0 })),
  };
}

function readLists(): CustomList[] {
  return readCollections().map(asList);
}

function useLists(): CustomList[] {
  const collections = useCollections();
  return useMemo(() => collections.map(asList), [collections]);
}

function useList(id: string | null): CustomList | null {
  const collection = useCollection(id);
  return useMemo(() => (collection ? asList(collection) : null), [collection]);
}

export const collectionListStore: ListStore = {
  storageKey: "harbor.collections.v1",
  readPersistedListSnapshot: readPersistedCollectionSnapshot,
  deleteListWithResult: (id, profile) => deleteCollectionWithResult(id, profile),
  renameListWithResult: renameCollectionWithResult,
  createListWithItem: (name, item, profile, description) =>
    createCollectionWithItems(name, [item], profile, description),
  createListWithItems: createCollectionWithItems,
  moveBetweenLists: moveBetweenCollections,
  setListMembership: setCollectionMembership,
  removeListMembership: removeCollectionMembership,
  readLists,
  // Collections are kept most recently changed first; they have no order of their own.
  reorderLists: () => {},
  reorderListItems: reorderCollectionItems,
  subscribeLists: subscribeCollections,
  createList: (name, description = "") => {
    const id = createCollection(name);
    if (id && description.trim()) setCollectionDescription(id, description);
    return id;
  },
  renameList: renameCollection,
  updateListDescription: setCollectionDescription,
  deleteList: deleteCollection,
  addToList: addToCollection,
  removeFromList: removeFromCollection,
  updateListItem: updateCollectionItem,
  toggleInList: toggleInCollection,
  listContains: collectionContains,
  useLists,
  useList,
  useListsContaining: useCollectionsContaining,
};
