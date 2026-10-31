"use client";
import {
  BookmarkIcon,
  EllipsisIcon,
  Search,
  Plus,
  Pencil,
  Trash2,
  Folder,
} from "lucide-react";
import { Button } from "./button";
import { SavedQuestions, SavedQuestion } from "@/types/savedQuestions";
import { SavedCollections, SavedCollection } from "@/types/savedCollections";
import { QuestionById_Data } from "@/types";
import { playSound } from "@/lib/playSound";
import { useResolvedCollections } from "@/hooks/use-resolved-user-data";
import { useState, useId, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { selectIsAuthenticated } from "@/lib/redux/selectors";
import {
  addBookmark as addBookmarkAction,
  removeBookmark as removeBookmarkAction,
  updateCollectionLocal,
  addCollection as addCollectionAction,
} from "@/lib/redux/slices/userDataSlice";
import {
  saveBookmark,
  removeBookmark as syncRemoveBookmark,
  saveCollection,
  updateCollection,
  removeCollection,
} from "@/lib/utils/dataSync";

interface SaveButtonProps {
  question: QuestionById_Data;
  assessment: string;
  isQuestionSaved: boolean;
  savedQuestions: SavedQuestions;
  setSavedQuestions: (value: SavedQuestions) => void;
  compact?: boolean;
}
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "./input";
import { DropdownMenuLabel, DropdownMenuSeparator } from "./dropdown-menu";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./dialog";
import { toast } from "sonner";

export function SaveButton({
  question,
  assessment,
  isQuestionSaved,
  savedQuestions,
  setSavedQuestions,
  compact = false,
}: SaveButtonProps) {
  const id = useId();
  const reduxDispatch = useAppDispatch();
  const reduxState = useAppSelector((s) => s);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [savedCollections, setSavedCollections] = useResolvedCollections();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingCollection, setEditingCollection] =
    useState<SavedCollection | null>(null);
  const [hoverCardOpen, setHoverCardOpen] = useState(false);

  const questionId = question.question.questionId;

  // Get all collections (now organized by ID, not assessment)
  const allCollections = Object.values(savedCollections);

  // Migrate collections that don't have questionDetails (backward compatibility)
  const migratedCollections = allCollections.map((collection, index) => {
    return {
      ...collection,
      id: collection.id || `collection_${index}_${Date.now()}`, // Ensure id exists
      questionIds: collection.questionIds ?? [], // Ensure questionIds is always an array
      questionDetails: collection.questionDetails ?? [], // Ensure questionDetails is always an array
    };
  });

  // Filter collections based on search term
  const filteredCollections = migratedCollections.filter((collection) =>
    collection.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Check which collections contain this question
  const questionCollections = migratedCollections.filter((collection) =>
    collection.questionIds.includes(questionId),
  );

  // Check if question is saved in any collection (this means it's also saved)
  const isQuestionInAnyCollection = questionCollections.length > 0;

  // The question is considered saved if it's either in savedQuestions OR in any collection
  const actualIsQuestionSaved = isQuestionSaved || isQuestionInAnyCollection;

  const handleSaveClick = () => {
    try {
      const updatedSavedQuestions = { ...savedQuestions };

      // Initialize array if it doesn't exist
      if (!updatedSavedQuestions[assessment]) {
        updatedSavedQuestions[assessment] = [];
      }

      // Check if question is already saved in savedQuestions
      const questionIndex = updatedSavedQuestions[assessment].findIndex(
        (q: SavedQuestion) => q.questionId === questionId,
      );

      if (questionIndex === -1 && !isQuestionInAnyCollection) {
        // Question not saved anywhere, so save it
        playSound("tap-checkbox-checked.wav");
        const newSavedQuestion: SavedQuestion = {
          questionId: questionId,
          externalId: question.question.external_id || null,
          ibn: question.question.ibn || null,
          plainQuestion: question.question,
          timestamp: new Date().toISOString(),
        };
        updatedSavedQuestions[assessment].push(newSavedQuestion);

        // Optimistic update for authenticated users
        if (isAuthenticated) {
          reduxDispatch(addBookmarkAction({ ...newSavedQuestion, assessment }));
        }

        // Sync: API for authenticated users, localStorage for unauthenticated
        saveBookmark(
          { ...newSavedQuestion, assessment },
          reduxDispatch,
          reduxState,
        );
        toast.success("Question saved!");
      } else {
        // Question is saved somewhere, so remove it completely
        playSound("tap-checkbox-unchecked.wav");

        // Remove from savedQuestions if it exists there
        if (questionIndex !== -1) {
          updatedSavedQuestions[assessment].splice(questionIndex, 1);
        }

        // Also remove from all collections
        const updatedCollections = { ...savedCollections };
        Object.keys(updatedCollections).forEach((collId) => {
          const col = updatedCollections[collId];
          if (col.questionIds.includes(questionId)) {
            const updatedCol = {
              ...col,
              questionIds: col.questionIds.filter(
                (id: string) => id !== questionId,
              ),
              questionDetails:
                col.questionDetails?.filter(
                  (detail) => detail.questionId !== questionId,
                ) || [],
              updatedAt: new Date().toISOString(),
            };
            updatedCollections[collId] = updatedCol;

            // Optimistic update for authenticated users
            if (isAuthenticated) {
              reduxDispatch(
                updateCollectionLocal({
                  collectionId: collId,
                  name: updatedCol.name || "",
                  description: updatedCol.description,
                  createdAt: updatedCol.createdAt || new Date().toISOString(),
                  updatedAt: updatedCol.updatedAt,
                  questionIds: updatedCol.questionIds,
                  questionDetails: (updatedCol.questionDetails || []).map(
                    (d) => ({
                      questionId: d.questionId,
                      externalId: d.externalId ?? null,
                      ibn: d.ibn ?? null,
                    }),
                  ),
                  color: updatedCol.color,
                }),
              );
            }

            // Sync collection update
            updateCollection(collId, updatedCol, reduxDispatch, reduxState);
          }
        });

        setSavedCollections(updatedCollections);

        // Optimistic update for authenticated users
        if (isAuthenticated) {
          reduxDispatch(removeBookmarkAction(questionId));
        }

        // Sync bookmark removal
        syncRemoveBookmark(questionId, reduxDispatch, reduxState);
        toast.success("Question removed from saved and all collections!");
      }

      setSavedQuestions(updatedSavedQuestions);
    } catch (error) {
      console.error("Failed to save/remove question:", error);
      toast.error("Failed to save question");
    }
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;

    try {
      const newCollection: SavedCollection = {
        id: `collection_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        name: newCollectionName.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        questionIds: [],
        questionDetails: [],
      };

      const updatedCollections = {
        ...savedCollections,
        [newCollection.id]: newCollection,
      };
      setSavedCollections(updatedCollections);
      // Optimistic update for authenticated users
      if (isAuthenticated) {
        reduxDispatch(
          addCollectionAction({
            collectionId: newCollection.id,
            name: newCollection.name,
            description: newCollection.description,
            createdAt: newCollection.createdAt,
            updatedAt: newCollection.updatedAt,
            questionIds: newCollection.questionIds,
            questionDetails: newCollection.questionDetails,
            color: newCollection.color,
          }),
        );
      }
      // Sync: API for authenticated users, localStorage for unauthenticated
      saveCollection(
        { ...newCollection, collectionId: newCollection.id },
        reduxDispatch,
        reduxState,
      );
      setNewCollectionName("");
      setIsCreateDialogOpen(false);
      playSound("tap-checkbox-checked.wav");
      toast.success(`Collection "${newCollection.name}" created!`);
    } catch (error) {
      console.error("Failed to create collection:", error);
      toast.error("Failed to create collection");
    }
  };

  const handleDeleteCollection = (collectionId: string) => {
    try {
      const updatedCollections = { ...savedCollections };
      const collectionToDelete = updatedCollections[collectionId];

      if (collectionToDelete) {
        delete updatedCollections[collectionId];
        setSavedCollections(updatedCollections);
        // Sync: API for authenticated users, localStorage for unauthenticated
        removeCollection(collectionId, reduxDispatch, reduxState);
        playSound("tap-checkbox-unchecked.wav");
        toast.success(`Collection "${collectionToDelete.name}" deleted!`);
      }
    } catch (error) {
      console.error("Failed to delete collection:", error);
      toast.error("Failed to delete collection");
    }
  };

  const handleRenameCollection = (collectionId: string, newName: string) => {
    if (!newName.trim()) return;

    try {
      const updatedCollections = { ...savedCollections };

      if (updatedCollections[collectionId]) {
        const updatedCol = {
          ...updatedCollections[collectionId],
          name: newName.trim(),
          updatedAt: new Date().toISOString(),
        };
        updatedCollections[collectionId] = updatedCol;
        setSavedCollections(updatedCollections);
        // Sync: API for authenticated users, localStorage for unauthenticated
        updateCollection(collectionId, updatedCol, reduxDispatch, reduxState);
        setEditingCollection(null);
        playSound("button-pressed.wav");
        toast.success("Collection renamed!");
      }
    } catch (error) {
      console.error("Failed to rename collection:", error);
      toast.error("Failed to rename collection");
    }
  };

  const handleToggleQuestionInCollection = (collectionId: string) => {
    try {
      const updatedCollections = { ...savedCollections };
      const updatedSavedQuestions = { ...savedQuestions };

      const collection = updatedCollections[collectionId];
      if (!collection) return;

      const collectionName = collection.name || "Untitled Collection";
      const questionExists = collection.questionIds.includes(questionId);

      if (questionExists) {
        // Remove question from collection
        const updatedCol = {
          ...collection,
          questionIds: collection.questionIds.filter(
            (id: string) => id !== questionId,
          ),
          questionDetails:
            collection.questionDetails?.filter(
              (detail) => detail.questionId !== questionId,
            ) || [],
          updatedAt: new Date().toISOString(),
        };
        updatedCollections[collectionId] = updatedCol;

        // Optimistic Redux update (authenticated users)
        if (isAuthenticated) {
          reduxDispatch(
            updateCollectionLocal({
              collectionId,
              name: updatedCol.name || "",
              description: updatedCol.description,
              createdAt: updatedCol.createdAt || new Date().toISOString(),
              updatedAt: updatedCol.updatedAt,
              questionIds: updatedCol.questionIds,
              questionDetails: (updatedCol.questionDetails || []).map((d) => ({
                questionId: d.questionId,
                externalId: d.externalId ?? null,
                ibn: d.ibn ?? null,
              })),
              color: updatedCol.color,
            }),
          );
        }

        setSavedCollections(updatedCollections);
        // Sync collection update
        updateCollection(collectionId, updatedCol, reduxDispatch, reduxState);
        playSound("tap-checkbox-unchecked.wav");
        toast.success(`Removed from "${collectionName}"`);
      } else {
        // Add question to collection
        const updatedCol = {
          ...collection,
          questionIds: [...collection.questionIds, questionId],
          questionDetails: [
            ...(collection.questionDetails || []),
            {
              questionId: questionId,
              externalId: question.question.external_id || null,
              ibn: question.question.ibn || null,
            },
          ],
          updatedAt: new Date().toISOString(),
        };
        updatedCollections[collectionId] = updatedCol;

        // Optimistic Redux update (authenticated users)
        if (isAuthenticated) {
          reduxDispatch(
            updateCollectionLocal({
              collectionId,
              name: updatedCol.name || "",
              description: updatedCol.description,
              createdAt: updatedCol.createdAt || new Date().toISOString(),
              updatedAt: updatedCol.updatedAt,
              questionIds: updatedCol.questionIds,
              questionDetails: updatedCol.questionDetails.map((d) => ({
                questionId: d.questionId,
                externalId: d.externalId ?? null,
                ibn: d.ibn ?? null,
              })),
              color: updatedCol.color,
            }),
          );
        }

        setSavedCollections(updatedCollections);
        // Sync collection update
        updateCollection(collectionId, updatedCol, reduxDispatch, reduxState);

        // Also ensure question is in savedQuestions / Redux bookmarks
        if (!updatedSavedQuestions[assessment]) {
          updatedSavedQuestions[assessment] = [];
        }
        const questionIndex = updatedSavedQuestions[assessment].findIndex(
          (q: SavedQuestion) => q.questionId === questionId,
        );
        if (questionIndex === -1) {
          const newSavedQuestion: SavedQuestion = {
            questionId: questionId,
            externalId: question.question.external_id || null,
            ibn: question.question.ibn || null,
            plainQuestion: question.question,
            timestamp: new Date().toISOString(),
          };
          updatedSavedQuestions[assessment].push(newSavedQuestion);
          setSavedQuestions(updatedSavedQuestions);

          // Optimistic Redux update for bookmark
          if (isAuthenticated) {
            reduxDispatch(
              addBookmarkAction({ ...newSavedQuestion, assessment }),
            );
          }

          // Sync bookmark addition
          saveBookmark(
            { ...newSavedQuestion, assessment },
            reduxDispatch,
            reduxState,
          );
        }

        playSound("tap-checkbox-checked.wav");
        toast.success(`Saved to "${collectionName}"`);
      }
    } catch (error) {
      console.error("Failed to toggle question in collection:", error);
      toast.error("Failed to update collection");
    }
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-xl overflow-visible">
      <Button
        aria-label={actualIsQuestionSaved ? "Remove from saved questions" : "Save question"}
        title={actualIsQuestionSaved ? "Saved question" : "Save question"}
        variant="default"
        className={`${compact ? "assessment-icon-button" : ""} flex cursor-pointer items-center gap-1 md:gap-2 font-bold py-2 md:py-3 px-3 md:px-6 border-b-4 transform transition-all duration-200 active:translate-y-0.5 active:border-b-2 text-xs md:text-sm rounded-none ${
          actualIsQuestionSaved
            ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-700 hover:border-yellow-800"
            : "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-700 hover:border-yellow-800"
        }`}
        onClick={handleSaveClick}
      >
        <BookmarkIcon
          className={`w-3 h-3 md:w-4 md:h-4 duration-300 group-hover:rotate-12 ${
            actualIsQuestionSaved ? "fill-current" : ""
          }`}
        />
        <span className="font-medium hidden sm:inline">
          {!compact && (actualIsQuestionSaved ? "Saved" : "Save")}
        </span>
      </Button>

      <HoverCard
        open={hoverCardOpen}
        onOpenChange={setHoverCardOpen}
        openDelay={100}
      >
        <HoverCardTrigger asChild>
          <Button
            className={`${compact ? "assessment-icon-button" : ""} border-b-4 transform transition-all duration-200 active:translate-y-0.5 active:border-b-2 rounded-none border-l-0 ${
              actualIsQuestionSaved
                ? "bg-yellow-500 hover:bg-yellow-700 text-white border-yellow-800 hover:border-yellow-900"
                : "bg-yellow-500 hover:bg-yellow-700 text-white border-yellow-800 hover:border-yellow-900"
            }`}
            variant="default"
            size="icon"
            aria-label="Manage collections"
            onClick={(e) => {
              e.preventDefault();
              playSound("button-pressed.wav");
              setHoverCardOpen(!hoverCardOpen);
            }}
          >
            <EllipsisIcon size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent
          align="end"
          className="w-80 overflow-hidden rounded-3xl border border-neutral-200 bg-white p-0 shadow-menu dark:border-neutral-800 dark:bg-neutral-950"
        >
          {/* Search Input */}
          <div className="p-3">
            <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 focus-within:ring-2 focus-within:ring-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
              <Input
                type="search"
                placeholder="Search collections..."
                className="pl-10 transition-colors "
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="mx-3 h-px bg-neutral-200 dark:bg-neutral-800"></div>

          {/* Collections List */}
          <div className="max-h-60 overflow-y-auto px-3 pb-3 pt-2">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Collections ({migratedCollections.length})
              </div>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="assessment-control h-8 rounded-lg px-3 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent
                  overlayClassName="bg-black/20 backdrop-blur-[2px] dark:bg-black/50"
                  className="assessment-modal assessment-modal--compact"
                >
                  <DialogHeader>
                    <DialogTitle className="assessment-modal-title text-2xl">
                      Create New Collection
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Collection name..."
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateCollection();
                        }
                      }}
                      className="border-neutral-300 focus-visible:ring-neutral-500 dark:border-neutral-700"
                    />
                  </div>
                  <DialogFooter className="assessment-modal-actions gap-2 sm:space-x-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setNewCollectionName("");
                      }}
                      className="assessment-modal-button assessment-modal-button--secondary flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateCollection}
                      disabled={!newCollectionName.trim()}
                      className="assessment-modal-button assessment-modal-button--primary flex-1"
                    >
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {filteredCollections.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                {migratedCollections.length === 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
                      <Folder className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
                    </div>
                    <div className="mb-1 font-medium text-neutral-700 dark:text-neutral-300">
                      No collections yet
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Create one to organize your saved questions!
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500 dark:text-neutral-400">
                    No collections match your search.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCollections.map((collection) => {
                  const isQuestionInCollection =
                    collection.questionIds.includes(questionId);
                  return (
                    <div
                      key={collection.id}
                      className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <Checkbox
                        id={`${id}-${collection.id}`}
                        checked={isQuestionInCollection}
                        onCheckedChange={() =>
                          handleToggleQuestionInCollection(collection.id)
                        }
                        className="rounded-md border-neutral-400 data-[state=checked]:border-neutral-900 data-[state=checked]:bg-neutral-900 dark:data-[state=checked]:border-neutral-100 dark:data-[state=checked]:bg-neutral-100"
                      />

                      {editingCollection?.id === collection.id ? (
                        <Input
                          value={editingCollection?.name || ""}
                          onChange={(e) =>
                            editingCollection &&
                            setEditingCollection({
                              ...editingCollection,
                              name: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editingCollection) {
                              handleRenameCollection(
                                collection.id,
                                editingCollection.name,
                              );
                            } else if (e.key === "Escape") {
                              setEditingCollection(null);
                            }
                          }}
                          onBlur={() =>
                            editingCollection &&
                            handleRenameCollection(
                              collection.id,
                              editingCollection.name,
                            )
                          }
                          className="h-9 flex-1 rounded-lg border border-neutral-300 text-sm focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700"
                          autoFocus
                        />
                      ) : (
                        <Label
                          htmlFor={`${id}-${collection.id}`}
                          className="flex-1 cursor-pointer truncate text-sm font-medium text-neutral-700 dark:text-neutral-300"
                          title={collection.name || "Untitled Collection"}
                        >
                          {collection.name || "Untitled Collection"}
                        </Label>
                      )}

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          onClick={() => setEditingCollection(collection)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                          onClick={() => handleDeleteCollection(collection.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="min-w-0 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {collection.questionIds.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {questionCollections.length > 0 && (
            <>
              <div className="mx-3 h-px bg-neutral-200 dark:bg-neutral-800"></div>
              <div className="px-3 py-3">
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  <div className="font-medium mb-2">
                    This question is saved in {questionCollections.length}{" "}
                    collection{questionCollections.length !== 1 ? "s" : ""}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {questionCollections.map((collection) => (
                      <span
                        key={collection.id}
                        className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                      >
                        {collection.name || "Untitled Collection"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
