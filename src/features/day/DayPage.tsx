import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { FlagTriangleRight } from "lucide-react";
import { useActivitiesStore } from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import ActivityCard from "./ActivityCard";
import { getDayViewData } from "./daySelectors";
import AddActivityModal from "../../shared/components/AddActivityModal";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { TouchDragOverlay, type TouchDragOverlayHandle } from "../../shared/components/TouchDragOverlay";
import { useAutoScroll } from "../../shared/hooks/useAutoScroll";
import { useThrottledCallback } from "../../shared/hooks/useThrottle";
import { AnimatePresence, motion } from "framer-motion";
import { FAST_TRANSITION, SLIDE_VARIANTS } from "../../shared/theme/animations";
import WeekActivityRow from "../week/WeekActivityRow";
import { DesktopDivider as Divider, DesktopEmptySlot as EmptySlot } from "../week/DesktopColumnPrimitives";

interface DayPageProps {
  activeDate: string;
  onResetToday?: () => void;
  direction?: number;
}

/**
 * Computes a preview order for activities when dragging.
 * Follows the same rules as the WeekPage: anchored activities (with time)
 * maintain their relative time-based order; flexible activities can be reordered freely.
 */
const computePreviewOrder = (
  activities: Activity[],
  draggedId: string,
  targetIndex: number
): Activity[] => {
  const dragged = activities.find((a) => a.id === draggedId);
  if (!dragged) return activities;

  const withoutDragged = activities.filter((a) => a.id !== draggedId);
  const clampedIndex = Math.min(Math.max(targetIndex, 0), withoutDragged.length);

  const merged = [
    ...withoutDragged.slice(0, clampedIndex),
    dragged,
    ...withoutDragged.slice(clampedIndex),
  ];

  // Anchored activities must maintain their time order
  const anchored = merged.filter((a) => a.time !== null).sort((a, b) => {
    if (a.time === null || b.time === null) return 0;
    return a.time.localeCompare(b.time);
  });

  let anchoredPtr = 0;
  return merged.map((item) => {
    if (item.time !== null) {
      return anchored[anchoredPtr++];
    }
    return item;
  });
};

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);
  const preventDefaultTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overlayRef = useRef<TouchDragOverlayHandle>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll(scrollContainer ?? window);

  // Throttle preview order updates to max 30fps for better performance on Android
  const throttledSetPreviewOrder = useThrottledCallback(
    (order: Activity[] | null) => setPreviewOrder(order),
    32
  );

  // Cleanup effect to ensure styles are always reset on unmount or when drag ends unexpectedly
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (preventDefaultTouchMoveRef.current) {
        document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
        preventDefaultTouchMoveRef.current = null;
      }
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  useEffect(() => {
    if (isTouchDrag && !preventDefaultTouchMoveRef.current) {
      const preventDefault = (e: TouchEvent) => {
        e.preventDefault();
      };
      preventDefaultTouchMoveRef.current = preventDefault;
      document.addEventListener("touchmove", preventDefault, { passive: false });
      return () => {
        if (preventDefaultTouchMoveRef.current) {
          document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
          preventDefaultTouchMoveRef.current = null;
        }
      };
    }
  }, [isTouchDrag]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) {
      setScrollContainer(main);
    } else {
      setScrollContainer(window);
    }
  }, []);

  const { overdue, todayAnchored, todayFlexible } = useMemo(
    () => getDayViewData(activities, activeDate),
    [activities, activeDate]
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

  const displayActivities = isDesktop && !isTouchDrag
    ? todayActivities
    : (previewOrder ?? todayActivities);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isToday = activeDate === todayIso;
  const isPast = activeDate < todayIso;
  const mobileListTitle = isToday ? "Today" : isPast ? "Past" : "Future";
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
    setDragOverKey(null);
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isDesktop || isTouchDrag || !draggingId) return;
    const reset = () => resetDragState();
    const resetIfDroppedOutside = (event: DragEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) {
        return;
      }
      resetDragState();
    };
    window.addEventListener("dragend", reset, true);
    window.addEventListener("drop", resetIfDroppedOutside, true);
    return () => {
      window.removeEventListener("dragend", reset, true);
      window.removeEventListener("drop", resetIfDroppedOutside, true);
    };
  }, [isDesktop, isTouchDrag, draggingId, resetDragState]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", activity.id);
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
  const todayAppendKey = "today-append";

  const handleDragOverZone = (event: React.DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDragLeaveZone = (
    event: React.DragEvent<HTMLElement> | null,
    key: string
  ) => {
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

    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    const activity = droppedId ? activities.find((a) => a.id === droppedId) : null;

    if (!activity) {
      resetDragState();
      return;
    }

    const sourceDate = activity.bucket === "scheduled" ? activity.date : null;

    if (!(activity.bucket === "scheduled" && activity.date === activeDate)) {
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

    const anchored = merged.filter((item) => item.time !== null).sort((a, b) => {
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

    reorderInDay(activeDate, finalOrder.map((item) => item.id));
    resetDragState();
  };

  // Touch drag handlers for mobile
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getTargetIndexFromY = useCallback((clientY: number): number => {
    if (!containerRef.current) return 0;
    const cards = containerRef.current.querySelectorAll("[data-activity-id]");
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

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>, activity: Activity) => {
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isTouchDraggingRef.current = false;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggingId(activity.id);
      setIsTouchDrag(true);
      // Store offset in ref for imperative updates (no re-render)
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      initialDragPosRef.current = { x: touch.clientX - offsetX, y: touch.clientY - offsetY };
      setPreviewOrder(null);
      const preventDefault = (e: TouchEvent) => e.preventDefault();
      preventDefaultTouchMoveRef.current = preventDefault;
      document.addEventListener("touchmove", preventDefault, { passive: false });
      // Prevent pull-to-refresh on Android
      document.body.style.overscrollBehavior = "none";
      if (scrollContainer && scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = "hidden";
        scrollContainer.style.touchAction = "none";
        scrollContainer.style.overscrollBehavior = "none";
      } else if (containerRef.current) {
        containerRef.current.style.overflow = "hidden";
        containerRef.current.style.touchAction = "none";
        containerRef.current.style.overscrollBehavior = "none";
      } else {
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
      }
    }, 150);
  }, [clearLongPressTimer, containerRef, scrollContainer]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>, activityId: string) => {
    const touch = event.touches[0];

    if (!isTouchDraggingRef.current) {
      const deltaX = Math.abs(touch.clientX - touchStartXRef.current);
      const deltaY = Math.abs(touch.clientY - touchStartYRef.current);

      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
      }
      return;
    }

    event.preventDefault();

    // Update overlay position imperatively (no React re-render) for smooth 60fps
    overlayRef.current?.updatePosition(
      touch.clientX - dragOffsetRef.current.x,
      touch.clientY - dragOffsetRef.current.y
    );

    const targetIndex = getTargetIndexFromY(touch.clientY);
    const draggedActivity = activities.find((a) => a.id === activityId);
    if (!draggedActivity) return;

    // If dragged activity is already in today's list, use computePreviewOrder
    if (draggedActivity.bucket === "scheduled" && draggedActivity.date === activeDate) {
      const newOrder = computePreviewOrder(todayActivities, activityId, targetIndex);
      // Throttled to prevent too many re-renders
      throttledSetPreviewOrder(newOrder);
    } else {
      // External drag (from Overdue): build placeholder and insert into today's list
      const placeholder: Activity = {
        ...draggedActivity,
        id: '__DRAG_PLACEHOLDER__',
      };
      const without = [...todayActivities];
      const clampedIndex = Math.min(Math.max(targetIndex, 0), without.length);
      const merged = [
        ...without.slice(0, clampedIndex),
        placeholder,
        ...without.slice(clampedIndex),
      ];
      // Maintain anchored order
      const anchored = merged.filter((a) => a.time !== null).sort((a, b) => {
        if (a.time === null || b.time === null) return 0;
        return a.time.localeCompare(b.time);
      });
      let anchoredPtr = 0;
      const ordered = merged.map((item) => {
        if (item.time !== null) {
          return anchored[anchoredPtr++];
        }
        return item;
      });
      // Throttled to prevent too many re-renders
      throttledSetPreviewOrder(ordered);
    }

    // Auto-scroll when near edges
    startAutoScroll(touch.clientY);
  }, [clearLongPressTimer, getTargetIndexFromY, todayActivities, startAutoScroll, throttledSetPreviewOrder, activities, activeDate]);

  const handleTouchEnd = useCallback((_activityId: string) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current && previewOrder) {
      const droppedId = draggingId ?? _activityId;
      const draggedActivity = activities.find((a) => a.id === droppedId);
      if (draggedActivity && !(draggedActivity.bucket === "scheduled" && draggedActivity.date === activeDate)) {
        scheduleActivity(droppedId, activeDate);
      }

      const finalOrderedIds = previewOrder.map((a) => (a.id === '__DRAG_PLACEHOLDER__' ? droppedId : a.id));
      reorderInDay(activeDate, finalOrderedIds);
    }

    isTouchDraggingRef.current = false;
    setIsTouchDrag(false);
    // Reset all scroll-related styles including overscrollBehavior
    document.body.style.overscrollBehavior = "";
    if (scrollContainer && scrollContainer instanceof HTMLElement) {
      scrollContainer.style.overflow = "";
      scrollContainer.style.touchAction = "";
      scrollContainer.style.overscrollBehavior = "";
    } else if (containerRef.current) {
      containerRef.current.style.overflow = "";
      containerRef.current.style.touchAction = "";
      containerRef.current.style.overscrollBehavior = "";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    if (preventDefaultTouchMoveRef.current) {
      document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
      preventDefaultTouchMoveRef.current = null;
    }
    stopAutoScroll();
    resetDragState();
  }, [clearLongPressTimer, previewOrder, reorderInDay, activeDate, stopAutoScroll, scrollContainer, activities, scheduleActivity, draggingId, resetDragState]);

  const formattedDate = useMemo(() => {
    if (!activeDate) return "";
    const date = new Date(`${activeDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return activeDate;
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [activeDate]);

  const canShowDesktopAddSlot = isDesktop && !draggingId;

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 lg:pt-0">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={activeDate}
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={FAST_TRANSITION}
            className="mt-0 md:mt-5 lg:mt-0"
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
                            {isToday && <FlagTriangleRight className="h-3.5 w-3.5 text-[var(--color-text-meta)]" />}
                          </button>
                        </div>
                        <div
                          onDragOver={(event) => handleDragOverZone(event, todayAppendKey)}
                          onDragLeave={(event) => handleDragLeaveZone(event, todayAppendKey)}
                          onDrop={(event) => handleDropOnToday(event, zoneIndex)}
                        >
                          <>
                            {todayActivities.map((activity) => {
                              const dropIndex = zoneIndex;
                              const zoneKey = makeTodayZoneKey(zoneIndex);
                              zoneIndex += 1;

                              return (
                                <motion.div
                                  layout
                                  initial={false}
                                  transition={FAST_TRANSITION}
                                  key={activity.id}
                                >
                                  <Divider
                                    isActive={dragOverKey === zoneKey}
                                    onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                                    onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                                    onDrop={(event) => handleDropOnToday(event, dropIndex)}
                                  />
                                  <WeekActivityRow
                                    activity={activity}
                                    onToggleDone={handleToggleDone}
                                    onEdit={handleEdit}
                                    draggable
                                    isDragging={draggingId === activity.id}
                                    disableHover={draggingId !== null}
                                    showNote
                                    onDragStart={(event) => handleDragStart(event, activity)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                                    onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                                    onDrop={(event) => handleDropOnToday(event, dropIndex)}
                                  />
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
                                        onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                        onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                        onDrop={(event) => handleDropOnToday(event, dropIndex)}
                                      />
                                      <div
                                        onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                        onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                        onDrop={(event) => handleDropOnToday(event, dropIndex)}
                                      >
                                        {canShowDesktopAddSlot ? (
                                          <EmptySlot label="Add to Today" onClick={handleOpenCreateModal} />
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
                        <div className="text-base text-[var(--color-text-meta)]">
                          {overdue.length > 0 ? overdue.length : ""}
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
                              draggable
                              isDragging={draggingId === activity.id}
                              disableHover={draggingId !== null}
                              showNote
                              onDragStart={(event) => handleDragStart(event, activity)}
                              onDragEnd={handleDragEnd}
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
                        {activity.id === '__DRAG_PLACEHOLDER__' ? (
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
                            onTouchStart={(e) => handleTouchStart(e, activity)}
                            onTouchMove={(e) => handleTouchMove(e, activity.id)}
                            onTouchEnd={() => handleTouchEnd(activity.id)}
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
                          onTouchStart={(e) => handleTouchStart(e, activity)}
                          onTouchMove={(e) => handleTouchMove(e, activity.id)}
                          onTouchEnd={() => handleTouchEnd(activity.id)}
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
          initialX={initialDragPosRef.current.x}
          initialY={initialDragPosRef.current.y}
        >
          <div className="w-[calc(100vw-32px)] max-w-xl pointer-events-none">
            {(() => {
              const activity = activities.find((a) => a.id === draggingId);
              if (!activity) return null;
              return (
                <div className="shadow-xl rounded-md bg-[var(--color-surface)]">
                  <ActivityCard
                    activity={activity}
                    onToggleDone={() => { }}
                    onEdit={() => { }}
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
