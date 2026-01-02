import type React from 'react';
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FlagTriangleRight } from 'lucide-react';
import {
  ActivityCard,
  AddActivityModal,
  DesktopDivider as Divider,
  DesktopEmptySlot as EmptySlot,
  TouchDragOverlay,
  type TouchDragOverlayHandle,
  WeekActivityRow,
} from '@/shared/ui';
import { useAutoScroll } from '@/shared/hooks/useAutoScroll';
import { useDesktopLayout } from '@/shared/hooks/useDesktopLayout';
import { useThrottledCallback } from '@/shared/hooks/useThrottle';
import { useTouchDragAndDrop } from '@/shared/hooks/useTouchDragAndDrop';
import { FAST_TRANSITION, SLIDE_VARIANTS } from '@/shared/ui/animations';
import type { Activity } from '@/shared/types/activity';
import {
  computeAnchoredPreviewOrder,
  computePlaceholderPreview,
  DRAG_PLACEHOLDER_ID,
} from '@/shared/utils/activityOrdering';
import { useActivitiesStore } from '@/shared/state';
import { getDayViewData } from './daySelectors';

interface DayPageProps {
  activeDate: string;
  onResetToday?: () => void;
  direction?: number;
}

const DayPage = ({ activeDate, onResetToday, direction = 0 }: DayPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const scheduleActivity = useActivitiesStore((state) => state.scheduleActivity);
  const reorderInDay = useActivitiesStore((state) => state.reorderInDay);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState<number>(72);
  const [previewOrder, setPreviewOrder] = useState<Activity[] | null>(null);
  const previewOrderRef = useRef<Activity[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);

  const { isDesktop, shouldUseTouch } = useDesktopLayout();
  const prefersTouchDrag = !isDesktop || shouldUseTouch;
  const enablePointerDrag = isDesktop && !shouldUseTouch;
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const overlayRef = useRef<TouchDragOverlayHandle>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll(scrollContainer ?? window);

  // Throttle preview order updates to max 30fps for better performance on Android
  const throttledSetPreviewOrder = useThrottledCallback(
    (order: Activity[] | null) => setPreviewOrder(order),
    32,
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const main = document.querySelector('main') as HTMLElement | null;
    if (main) {
      setScrollContainer(main);
    } else {
      setScrollContainer(window);
    }
  }, []);

  const { overdue, todayAnchored, todayFlexible } = useMemo(
    () => getDayViewData(activities, activeDate),
    [activities, activeDate],
  );

  const todayActivities = useMemo(() => {
    // Combine anchored and flexible activities, then sort by orderIndex
    const combined = [...todayAnchored, ...todayFlexible];

    // Sort by orderIndex if present, maintaining time-based order for anchored activities
    combined.sort((a, b) => {
      // Both have orderIndex - use it
      if (a.orderIndex !== null && b.orderIndex !== null) {
        return a.orderIndex - b.orderIndex;
      }
      // Only a has orderIndex - it comes first
      if (a.orderIndex !== null) {
        return -1;
      }
      // Only b has orderIndex - it comes first
      if (b.orderIndex !== null) {
        return 1;
      }
      // Neither has orderIndex - anchored activities sorted by time come before flexible
      if (a.time !== null && b.time !== null) {
        return a.time.localeCompare(b.time);
      }
      if (a.time !== null) {
        return -1;
      }
      if (b.time !== null) {
        return 1;
      }
      // Both flexible without orderIndex - sort by createdAt
      return a.createdAt.localeCompare(b.createdAt);
    });

    return combined;
  }, [todayAnchored, todayFlexible]);

  const displayActivities =
    isDesktop && !isTouchDrag ? todayActivities : (previewOrder ?? todayActivities);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isToday = activeDate === todayIso;
  const isPast = activeDate < todayIso;
  const mobileListTitle = isToday ? 'Today' : isPast ? 'Past' : 'Future';
  const hasOverdue = overdue.length > 0 && isToday;
  const hasDisplayActivities = displayActivities.length > 0;

  const handleToggleDone = (id: string) => {
    toggleDone(id);
  };

  const handleEdit = (activity: Activity) => {
    setActivityBeingEdited(activity);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setActivityBeingEdited(null);
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleDeleteActivity = (id: string) => {
    deleteActivity(id);
    handleCloseEditModal();
  };

  const resetDragState = useCallback(() => {
    setDraggingId(null);
    setPreviewOrder(null);
    previewOrderRef.current = null;
    setDragOverKey(null);
    throttledSetPreviewOrder.cancel();
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    stopAutoScroll();
  }, [throttledSetPreviewOrder, stopAutoScroll]);

  useEffect(() => {
    if (!isDesktop || isTouchDrag || !draggingId || !enablePointerDrag) return;
    const reset = () => resetDragState();
    const resetIfDroppedOutside = (event: DragEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) {
        return;
      }
      resetDragState();
    };
    window.addEventListener('dragend', reset, true);
    window.addEventListener('drop', resetIfDroppedOutside, true);
    return () => {
      window.removeEventListener('dragend', reset, true);
      window.removeEventListener('drop', resetIfDroppedOutside, true);
    };
  }, [isDesktop, isTouchDrag, draggingId, enablePointerDrag, resetDragState]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', activity.id);
    setDraggingId(activity.id);
    setPreviewOrder(null);
    setDragOverKey(null);

    // Capture the height of the card being dragged
    const target = event.currentTarget;
    if (target) {
      setDraggedCardHeight(target.offsetHeight);
    }
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const makeTodayZoneKey = (zoneIndex: number) => `today-zone-${zoneIndex}`;
  const todayAppendKey = 'today-append';

  const handleDragOverZone = (event: React.DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
    startAutoScroll(event.clientY);
  };

  const handleDragLeaveZone = (event: React.DragEvent<HTMLElement> | null, key: string) => {
    if (event) {
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) {
        return;
      }
    }
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
    }
    dragLeaveTimeoutRef.current = window.setTimeout(() => {
      if (dragOverKey === key) {
        setDragOverKey(null);
      }
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const handleDropOnToday = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedId = draggingId ?? event.dataTransfer.getData('text/plain');
    const activity = droppedId ? activities.find((a) => a.id === droppedId) : null;

    if (!activity) {
      resetDragState();
      return;
    }

    const sourceDate = activity.bucket === 'scheduled' ? activity.date : null;

    if (!(activity.bucket === 'scheduled' && activity.date === activeDate)) {
      scheduleActivity(activity.id, activeDate);
    }

    const currentDayItems = todayActivities;
    const currentIndex = currentDayItems.findIndex((item) => item.id === activity.id);
    let adjustedIndex = targetIndex;
    if (sourceDate === activeDate && currentIndex >= 0 && targetIndex > currentIndex) {
      adjustedIndex = targetIndex - 1;
    }
    const withoutDropped = currentDayItems.filter((item) => item.id !== activity.id);
    const clampedIndex = Math.min(Math.max(adjustedIndex, 0), withoutDropped.length);
    const merged = [
      ...withoutDropped.slice(0, clampedIndex),
      activity,
      ...withoutDropped.slice(clampedIndex),
    ];

    const anchored = merged
      .filter((item) => item.time !== null)
      .sort((a, b) => {
        if (a.time === null || b.time === null) return 0;
        return a.time.localeCompare(b.time);
      });
    let anchoredPtr = 0;
    const finalOrder = merged.map((item) => {
      if (item.time !== null) {
        return anchored[anchoredPtr++];
      }
      return item;
    });

    reorderInDay(
      activeDate,
      finalOrder.map((item) => item.id),
    );
    resetDragState();
  };

  // Touch drag handlers for mobile/tablet
  const getTargetIndexFromY = useCallback((clientY: number): number => {
    if (!containerRef.current) return 0;
    const cards = containerRef.current.querySelectorAll('[data-activity-id]');
    let targetIndex = 0;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY > midY) {
        targetIndex = index + 1;
      }
    });

    return targetIndex;
  }, []);

  const touchDnd = useTouchDragAndDrop<null>({
    enabled: prefersTouchDrag,
    overlayRef,
    scrollLock: {
      getScrollContainer: () => scrollContainer,
      getFallbackElement: () => containerRef.current,
    },
    onDragStart: ({ id, rect }) => {
      setDraggedCardHeight(rect.height);
      setDraggingId(id);
      setIsTouchDrag(true);
      setPreviewOrder(null);
      previewOrderRef.current = null;
    },
    onDragMove: ({ id, clientY }) => {
      const targetIndex = getTargetIndexFromY(clientY);
      const draggedActivity = activities.find((a) => a.id === id);
      if (!draggedActivity) return;

      const nextPreview =
        draggedActivity.bucket === 'scheduled' && draggedActivity.date === activeDate
          ? computeAnchoredPreviewOrder(todayActivities, id, targetIndex)
          : computePlaceholderPreview(todayActivities, draggedActivity, targetIndex);

      previewOrderRef.current = nextPreview;
      throttledSetPreviewOrder(nextPreview);
      startAutoScroll(clientY);
    },
    onDragEnd: ({ id, cancelled }) => {
      if (!cancelled && previewOrderRef.current) {
        const draggedActivity = activities.find((a) => a.id === id);
        if (
          draggedActivity &&
          !(draggedActivity.bucket === 'scheduled' && draggedActivity.date === activeDate)
        ) {
          scheduleActivity(id, activeDate);
        }

        const finalOrderedIds = previewOrderRef.current.map((a) =>
          a.id === DRAG_PLACEHOLDER_ID ? id : a.id,
        );
        reorderInDay(activeDate, finalOrderedIds);
      }

      setIsTouchDrag(false);
      stopAutoScroll();
      resetDragState();
    },
  });

  const formattedDate = useMemo(() => {
    if (!activeDate) return '';
    const date = new Date(`${activeDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return activeDate;
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [activeDate]);

  const canShowDesktopAddSlot = isDesktop && !draggingId;

  return (
    <>
      <div className={`mx-auto w-full max-w-xl px-4 ${isDesktop ? 'pt-0' : 'pt-4'}`}>
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={activeDate}
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={FAST_TRANSITION}
            className={isDesktop ? 'mt-0' : 'mt-0 md:mt-5'}
            ref={containerRef}
          >
            {isDesktop ? (
              <div className="space-y-8">
                <div className="space-y-8">
                  {(() => {
                    const placeholderCount = Math.max(5 - todayActivities.length, 0);
                    const totalSlots = Math.max(placeholderCount, 1);
                    let zoneIndex = 0;

                    return (
                      <div className="flex min-h-64 flex-col gap-2 px-1 py-3 rounded-xl">
                        <div className="flex items-baseline justify-between gap-2 px-1">
                          <button
                            type="button"
                            onClick={onResetToday}
                            className="flex items-center gap-2 text-base font-semibold text-left text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
                            aria-label="Go to today"
                          >
                            <span>{formattedDate}</span>
                            {isToday && (
                              <FlagTriangleRight className="h-3.5 w-3.5 text-[var(--color-text-meta)]" />
                            )}
                          </button>
                        </div>
                        <div
                          onDragOver={(event) => handleDragOverZone(event, todayAppendKey)}
                          onDragLeave={(event) => handleDragLeaveZone(event, todayAppendKey)}
                          onDrop={(event) => handleDropOnToday(event, zoneIndex)}
                        >
                          <>
                            {displayActivities.map((activity) => {
                              const dropIndex = zoneIndex;
                              const zoneKey = makeTodayZoneKey(zoneIndex);
                              zoneIndex += 1;
                              const isPlaceholder = activity.id === DRAG_PLACEHOLDER_ID;

                              return (
                                <motion.div
                                  layout
                                  initial={false}
                                  transition={FAST_TRANSITION}
                                  key={activity.id}
                                  data-activity-id={activity.id}
                                >
                                  <Divider
                                    isActive={dragOverKey === zoneKey}
                                    onDragOver={
                                      enablePointerDrag
                                        ? (event) => handleDragOverZone(event, zoneKey)
                                        : undefined
                                    }
                                    onDragLeave={
                                      enablePointerDrag
                                        ? (event) => handleDragLeaveZone(event, zoneKey)
                                        : undefined
                                    }
                                    onDrop={
                                      enablePointerDrag
                                        ? (event) => handleDropOnToday(event, dropIndex)
                                        : undefined
                                    }
                                  />
                                  {isPlaceholder ? (
                                    <div style={{ height: `${draggedCardHeight}px` }} />
                                  ) : (
                                    <WeekActivityRow
                                      activity={activity}
                                      onToggleDone={handleToggleDone}
                                      onEdit={handleEdit}
                                      draggable={enablePointerDrag}
                                      isDragging={draggingId === activity.id}
                                      disableHover={draggingId !== null}
                                      showNote
                                      onDragStart={
                                        enablePointerDrag
                                          ? (event) => handleDragStart(event, activity)
                                          : undefined
                                      }
                                      onDragEnd={enablePointerDrag ? handleDragEnd : undefined}
                                      onDragOver={
                                        enablePointerDrag
                                          ? (event) => handleDragOverZone(event, zoneKey)
                                          : undefined
                                      }
                                      onDragLeave={
                                        enablePointerDrag
                                          ? (event) => handleDragLeaveZone(event, zoneKey)
                                          : undefined
                                      }
                                      onDrop={
                                        enablePointerDrag
                                          ? (event) => handleDropOnToday(event, dropIndex)
                                          : undefined
                                      }
                                      onTouchStart={
                                        prefersTouchDrag
                                          ? touchDnd.getTouchStartProps(activity.id, null)
                                              .onTouchStart
                                          : undefined
                                      }
                                    />
                                  )}
                                </motion.div>
                              );
                            })}
                            {Array.from({ length: totalSlots }).map((_, idx) => {
                              const dropIndex = zoneIndex;
                              const zoneKey = makeTodayZoneKey(zoneIndex);
                              zoneIndex += 1;
                              const isPrimaryDrop = idx === 0;
                              const activeKey = isPrimaryDrop ? todayAppendKey : zoneKey;
                              return (
                                <div key={`today-placeholder-${idx}`}>
                                  {isPrimaryDrop ? (
                                    <>
                                      <Divider
                                        isActive={dragOverKey === activeKey}
                                        onDragOver={
                                          enablePointerDrag
                                            ? (event) => handleDragOverZone(event, activeKey)
                                            : undefined
                                        }
                                        onDragLeave={
                                          enablePointerDrag
                                            ? (event) => handleDragLeaveZone(event, activeKey)
                                            : undefined
                                        }
                                        onDrop={
                                          enablePointerDrag
                                            ? (event) => handleDropOnToday(event, dropIndex)
                                            : undefined
                                        }
                                      />
                                      <div
                                        onDragOver={
                                          enablePointerDrag
                                            ? (event) => handleDragOverZone(event, activeKey)
                                            : undefined
                                        }
                                        onDragLeave={
                                          enablePointerDrag
                                            ? (event) => handleDragLeaveZone(event, activeKey)
                                            : undefined
                                        }
                                        onDrop={
                                          enablePointerDrag
                                            ? (event) => handleDropOnToday(event, dropIndex)
                                            : undefined
                                        }
                                      >
                                        {canShowDesktopAddSlot ? (
                                          <EmptySlot onClick={handleOpenCreateModal} />
                                        ) : (
                                          <div className="min-h-[38px]" />
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <Divider />
                                      <div className="min-h-[38px]" />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        </div>
                      </div>
                    );
                  })()}

                  {hasOverdue && (
                    <div className="flex min-h-64 flex-col gap-2 px-1 py-3 rounded-xl">
                      <div className="flex items-baseline justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5 text-base font-semibold text-[var(--color-text-primary)]">
                          <span>Overdue</span>
                        </div>
                        <div className="text-base text-[var(--color-text-meta)] mr-3">
                          {overdue.length > 0 ? overdue.length : ''}
                        </div>
                      </div>
                      <div>
                        {overdue.map((activity) => (
                          <div key={activity.id}>
                            <Divider />
                            <WeekActivityRow
                              activity={activity}
                              onToggleDone={handleToggleDone}
                              onEdit={handleEdit}
                              draggable={enablePointerDrag}
                              isDragging={draggingId === activity.id}
                              disableHover={draggingId !== null}
                              showNote
                              onDragStart={
                                enablePointerDrag
                                  ? (event) => handleDragStart(event, activity)
                                  : undefined
                              }
                              onDragEnd={enablePointerDrag ? handleDragEnd : undefined}
                              onTouchStart={
                                prefersTouchDrag
                                  ? touchDnd.getTouchStartProps(activity.id, null).onTouchStart
                                  : undefined
                              }
                            />
                          </div>
                        ))}
                        <Divider />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={onResetToday}
                    className="text-base font-semibold text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
                    aria-label="Go to today"
                  >
                    {mobileListTitle}
                  </button>
                </div>
                <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
                {hasDisplayActivities ? (
                  <>
                    {displayActivities.map((activity) => (
                      <motion.div
                        layout
                        key={activity.id}
                        data-activity-id={activity.id}
                        initial={false}
                        transition={FAST_TRANSITION}
                      >
                        {activity.id === DRAG_PLACEHOLDER_ID ? (
                          <div style={{ height: `${draggedCardHeight}px` }} />
                        ) : (
                          <ActivityCard
                            activity={activity}
                            onToggleDone={handleToggleDone}
                            onEdit={handleEdit}
                            draggable={isDesktop}
                            isDragging={draggingId === activity.id}
                            disableHover={draggingId !== null}
                            onDragStart={(e) => handleDragStart(e, activity)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={
                              touchDnd.getTouchStartProps(activity.id, null).onTouchStart
                            }
                          />
                        )}
                      </motion.div>
                    ))}
                    <div className="h-8" />
                  </>
                ) : (
                  <div className="text-left">
                    <div className="py-4 min-h-[44px] relative flex items-center justify-center px-2">
                      <p className="text-sm text-[var(--color-text-subtle)] transition-opacity transform -translate-y-1">
                        A quiet day.
                      </p>
                    </div>
                  </div>
                )}
                {hasOverdue && (
                  <div className="mt-8 mb-4">
                    <div className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
                      Overdue
                    </div>
                    <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
                    <div>
                      {overdue.map((activity) => (
                        <ActivityCard
                          key={activity.id}
                          activity={activity}
                          onToggleDone={handleToggleDone}
                          onEdit={handleEdit}
                          draggable={isDesktop}
                          isDragging={draggingId === activity.id}
                          disableHover={draggingId !== null}
                          onDragStart={(e) => handleDragStart(e, activity)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={touchDnd.getTouchStartProps(activity.id, null).onTouchStart}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit Modal */}
      <AddActivityModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        mode="edit"
        activityToEdit={activityBeingEdited ?? undefined}
        onDelete={handleDeleteActivity}
        onUpdate={updateActivity}
        defaultDate={activeDate}
      />

      {/* Create Modal */}
      <AddActivityModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        mode="create"
        initialPlacement="scheduled"
        defaultDate={activeDate}
      />

      {/* Touch Drag Overlay - uses imperative position updates for 60fps performance */}
      {isTouchDrag && draggingId && (
        <TouchDragOverlay
          ref={overlayRef}
          initialX={touchDnd.initialPositionRef.current.x}
          initialY={touchDnd.initialPositionRef.current.y}
        >
          <div className="w-[calc(100vw-32px)] max-w-xl pointer-events-none">
            {(() => {
              const activity = activities.find((a) => a.id === draggingId);
              if (!activity) return null;
              return (
                <div className="shadow-xl rounded-md bg-[var(--color-surface)]">
                  <ActivityCard
                    activity={activity}
                    onToggleDone={() => {}}
                    onEdit={() => {}}
                    disableHover
                    forceHover
                  />
                </div>
              );
            })()}
          </div>
        </TouchDragOverlay>
      )}
    </>
  );
};

export default DayPage;
