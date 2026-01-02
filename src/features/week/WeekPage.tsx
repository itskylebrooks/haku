import type React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
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
import { useTouchDragAndDrop } from '@/shared/hooks/useTouchDragAndDrop';
import { FAST_TRANSITION, SLIDE_VARIANTS } from '@/shared/ui/animations';
import type { Activity, Bucket } from '@/shared/types/activity';
import {
  computeAnchoredPreviewOrder,
  computePlaceholderPreview,
  DRAG_PLACEHOLDER_ID,
} from '@/shared/utils/activityOrdering';
import { getInboxActivities, getLaterActivities, useActivitiesStore } from '@/shared/state';
import { getWeekActivities, getWeekDates, getWeekStartDate } from './weekSelectors';
import { distributeIntoTwoColumns } from './columnDistribution';

interface WeekPageProps {
  activeDate: string;
  weekStart: 'monday' | 'sunday';
  onResetToday?: () => void;
  direction?: number;
}

const formatMobileDayLabel = (isoDate: string): { weekday: string; monthDay: string } => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { weekday: isoDate, monthDay: '' };

  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return { weekday, monthDay };
};

const formatDesktopDayLabel = formatMobileDayLabel;

const WeekPage = ({ activeDate, weekStart, onResetToday, direction = 0 }: WeekPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const moveToInbox = useActivitiesStore((state) => state.moveToInbox);
  const moveToLater = useActivitiesStore((state) => state.moveToLater);
  const scheduleActivity = useActivitiesStore((state) => state.scheduleActivity);
  const reorderInDay = useActivitiesStore((state) => state.reorderInDay);
  const reorderInBucket = useActivitiesStore((state) => state.reorderInBucket);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newActivityDate, setNewActivityDate] = useState<string | null>(null);
  const [newActivityPlacement, setNewActivityPlacement] = useState<Bucket>('scheduled');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState<number>(72);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [mobilePreviewOrder, setMobilePreviewOrder] = useState<Record<string, Activity[]>>({});
  const [mobileDragOverDate, setMobileDragOverDate] = useState<string | null>(null);
  const [bucketPreviewOrder, setBucketPreviewOrder] = useState<
    Partial<Record<Extract<Bucket, 'inbox' | 'later'>, Activity[]>>
  >({});
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const mobileContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bucketContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bucketColumnMetaRef = useRef<
    Record<string, { bucket: Extract<Bucket, 'inbox' | 'later'>; startIndex: number }>
  >({});
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);
  type TouchTarget =
    | { type: 'day'; date: string }
    | { type: 'bucket'; bucket: Extract<Bucket, 'inbox' | 'later'>; columnKey: string };
  const touchDragOriginRef = useRef<TouchTarget | null>(null);
  const touchDragTargetRef = useRef<TouchTarget | null>(null);
  const touchDragDateRef = useRef<string | null>(null);
  const mobilePreviewOrderRef = useRef<Record<string, Activity[]>>({});
  const bucketPreviewOrderRef = useRef<
    Partial<Record<Extract<Bucket, 'inbox' | 'later'>, Activity[]>>
  >({});

  const { isDesktop, isDesktopNarrow, isWideDesktop, shouldUseTouch } = useDesktopLayout();
  const prefersTouchDrag = !isDesktop || shouldUseTouch;
  const enablePointerDrag = isDesktop && !shouldUseTouch;
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const overlayRef = useRef<TouchDragOverlayHandle>(null);
  // Cached date container rects to avoid layout thrashing during drag
  const cachedDateRectsRef = useRef<Record<string, DOMRect>>({});
  const cachedBucketRectsRef = useRef<Record<string, DOMRect>>({});
  const lastDateUpdateRef = useRef<number>(0);
  const mobilePreviewRafRef = useRef<number | null>(null);
  const bucketPreviewRafRef = useRef<number | null>(null);
  const measurementRafRef = useRef<number | null>(null);
  const pendingMeasureDatesRef = useRef<Set<string>>(new Set());
  const pendingMeasureBucketsRef = useRef<Set<string>>(new Set());
  const dayMidpointsRef = useRef<Record<string, number[]>>({});
  const bucketMidpointsRef = useRef<Record<string, number[]>>({});

  const flushMobilePreview = useCallback(() => {
    mobilePreviewRafRef.current = null;
    setMobilePreviewOrder({ ...mobilePreviewOrderRef.current });
  }, []);

  const flushBucketPreview = useCallback(() => {
    bucketPreviewRafRef.current = null;
    setBucketPreviewOrder({ ...bucketPreviewOrderRef.current });
  }, []);

  const scheduleMobilePreviewCommit = useCallback(() => {
    if (mobilePreviewRafRef.current !== null) return;
    mobilePreviewRafRef.current = requestAnimationFrame(flushMobilePreview);
  }, [flushMobilePreview]);

  const scheduleBucketPreviewCommit = useCallback(() => {
    if (bucketPreviewRafRef.current !== null) return;
    bucketPreviewRafRef.current = requestAnimationFrame(flushBucketPreview);
  }, [flushBucketPreview]);

  const isSamePreviewList = useCallback(
    (existing: Activity[] | undefined, next: Activity[] | null) => {
      if (!existing || !next) return false;
      if (existing.length !== next.length) return false;
      for (let i = 0; i < existing.length; i += 1) {
        if (existing[i].id !== next[i].id) return false;
      }
      return true;
    },
    [],
  );

  const updateMobilePreview = useCallback(
    (date: string | null, order: Activity[] | null) => {
      if (date && order) {
        const existing = mobilePreviewOrderRef.current[date];
        if (isSamePreviewList(existing, order)) {
          return;
        }
        mobilePreviewOrderRef.current = { [date]: order };
      } else {
        if (Object.keys(mobilePreviewOrderRef.current).length === 0) {
          return;
        }
        mobilePreviewOrderRef.current = {};
      }
      scheduleMobilePreviewCommit();
    },
    [isSamePreviewList, scheduleMobilePreviewCommit],
  );

  const updateBucketPreview = useCallback(
    (bucket: Extract<Bucket, 'inbox' | 'later'> | null, order: Activity[] | null) => {
      if (bucket && order) {
        const existing = bucketPreviewOrderRef.current[bucket];
        if (isSamePreviewList(existing, order)) {
          return;
        }
        bucketPreviewOrderRef.current = { [bucket]: order };
      } else {
        if (Object.keys(bucketPreviewOrderRef.current).length === 0) {
          return;
        }
        bucketPreviewOrderRef.current = {};
      }
      scheduleBucketPreviewCommit();
    },
    [isSamePreviewList, scheduleBucketPreviewCommit],
  );

  const measureDayMidpoints = useCallback((date: string) => {
    const container = mobileContainerRefs.current[date];
    if (!container) {
      dayMidpointsRef.current[date] = [];
      return;
    }
    const cards = container.querySelectorAll<HTMLElement>('[data-activity-id]');
    const midpoints: number[] = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      midpoints.push(rect.top + rect.height / 2);
    });
    dayMidpointsRef.current[date] = midpoints;
  }, []);

  const measureBucketMidpoints = useCallback((columnKey: string) => {
    const container = bucketContainerRefs.current[columnKey];
    if (!container) {
      bucketMidpointsRef.current[columnKey] = [];
      return;
    }
    const cards = container.querySelectorAll<HTMLElement>('[data-activity-id]');
    const midpoints: number[] = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      midpoints.push(rect.top + rect.height / 2);
    });
    bucketMidpointsRef.current[columnKey] = midpoints;
  }, []);

  const flushPendingMeasurements = useCallback(() => {
    measurementRafRef.current = null;
    pendingMeasureDatesRef.current.forEach((date) => measureDayMidpoints(date));
    pendingMeasureDatesRef.current.clear();
    pendingMeasureBucketsRef.current.forEach((key) => measureBucketMidpoints(key));
    pendingMeasureBucketsRef.current.clear();
  }, [measureBucketMidpoints, measureDayMidpoints]);

  const scheduleMeasurement = useCallback(
    (type: 'day' | 'bucket', key: string) => {
      if (type === 'day') {
        pendingMeasureDatesRef.current.add(key);
      } else {
        pendingMeasureBucketsRef.current.add(key);
      }
      if (measurementRafRef.current === null) {
        measurementRafRef.current = requestAnimationFrame(flushPendingMeasurements);
      }
    },
    [flushPendingMeasurements],
  );

  const clearMeasurementCaches = useCallback(() => {
    dayMidpointsRef.current = {};
    bucketMidpointsRef.current = {};
    pendingMeasureDatesRef.current.clear();
    pendingMeasureBucketsRef.current.clear();
    if (measurementRafRef.current !== null) {
      cancelAnimationFrame(measurementRafRef.current);
      measurementRafRef.current = null;
    }
  }, []);

  // Find the nearest main scroll container within AppShell (default) once mounted
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const main = document.querySelector('main') as HTMLElement | null;
    if (main) {
      setScrollContainer(main);
    } else {
      setScrollContainer(window);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (dragLeaveTimeoutRef.current !== null) {
        window.clearTimeout(dragLeaveTimeoutRef.current);
      }
      if (mobilePreviewRafRef.current !== null) {
        cancelAnimationFrame(mobilePreviewRafRef.current);
      }
      if (bucketPreviewRafRef.current !== null) {
        cancelAnimationFrame(bucketPreviewRafRef.current);
      }
      clearMeasurementCaches();
    };
  }, [clearMeasurementCaches]);

  const weekStartDate = useMemo(
    () => getWeekStartDate(activeDate, weekStart),
    [activeDate, weekStart],
  );
  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  // The layout displays 6 columns in the primary row and one extra column in the
  // secondary row. Instead of hard-coding Sunday as the extra column, use the
  // 7th item from `weekDates` so the UI adapts when the first day of the week
  // (weekStart) changes.
  const topWeekDates = useMemo(() => weekDates.slice(0, 6), [weekDates]);
  const extraDate = useMemo(() => (weekDates.length === 7 ? weekDates[6] : null), [weekDates]);

  // Callback to refresh cached date container rects during autoscroll
  const refreshCachedRects = useCallback(() => {
    for (const date of weekDates) {
      const container = mobileContainerRefs.current[date];
      if (container) {
        cachedDateRectsRef.current[date] = container.getBoundingClientRect();
      }
    }
    Object.entries(bucketContainerRefs.current).forEach(([key, container]) => {
      if (container) {
        cachedBucketRectsRef.current[key] = container.getBoundingClientRect();
      }
    });
    const activeDay =
      touchDragTargetRef.current?.type === 'day' ? touchDragTargetRef.current.date : null;
    if (activeDay) {
      scheduleMeasurement('day', activeDay);
    }
    const activeBucketKey =
      touchDragTargetRef.current?.type === 'bucket' ? touchDragTargetRef.current.columnKey : null;
    if (activeBucketKey) {
      scheduleMeasurement('bucket', activeBucketKey);
    }
  }, [scheduleMeasurement, weekDates]);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll({
    scrollContainer: scrollContainer ?? window,
    onScrolling: refreshCachedRects,
  });
  const weekActivities = useMemo(
    () => getWeekActivities(activities, weekStartDate),
    [activities, weekStartDate],
  );
  const inboxActivities = useMemo(() => getInboxActivities(activities), [activities]);
  const laterActivities = useMemo(() => getLaterActivities(activities), [activities]);
  const displayInboxActivities = useMemo(
    () => (prefersTouchDrag ? (bucketPreviewOrder.inbox ?? inboxActivities) : inboxActivities),
    [prefersTouchDrag, bucketPreviewOrder.inbox, inboxActivities],
  );
  const displayLaterActivities = useMemo(
    () => (prefersTouchDrag ? (bucketPreviewOrder.later ?? laterActivities) : laterActivities),
    [prefersTouchDrag, bucketPreviewOrder.later, laterActivities],
  );
  const [inboxPrimary, inboxSecondary] = useMemo(
    () => distributeIntoTwoColumns(displayInboxActivities),
    [displayInboxActivities],
  );
  const [laterPrimary, laterSecondary] = useMemo(
    () => distributeIntoTwoColumns(displayLaterActivities),
    [displayLaterActivities],
  );
  const desktopMaxDividerCount = useMemo(() => {
    const counts = topWeekDates.map((date) => weekActivities[date]?.length ?? 0);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    return Math.max(5, maxCount);
  }, [weekActivities, topWeekDates]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

  const handleDeleteActivity = (id: string) => {
    deleteActivity(id);
    handleCloseEditModal();
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewActivityDate(null);
    setNewActivityPlacement('scheduled');
  };

  const handleOpenCreateModal = ({
    date = null,
    placement = 'scheduled',
  }: {
    date?: string | null;
    placement?: Bucket;
  }) => {
    setNewActivityDate(date);
    setNewActivityPlacement(placement);
    setIsCreateModalOpen(true);
  };

  const makeDayZoneKey = (date: string, zoneIndex: number) => `day-zone-${date}-${zoneIndex}`;
  const makeDayAppendKey = (date: string) => `day-append-${date}`;
  const makeBucketZoneKey = (bucket: Extract<Bucket, 'inbox' | 'later'>, zoneIndex: number) =>
    `bucket-${bucket}-zone-${zoneIndex}`;

  const findActivityById = (id: string | null): Activity | null =>
    id ? (activities.find((activity) => activity.id === id) ?? null) : null;

  const resetDragState = useCallback(() => {
    setDraggingId(null);
    setDragOverKey(null);
    setMobilePreviewOrder({});
    setBucketPreviewOrder({});
    setMobileDragOverDate(null);
    mobilePreviewOrderRef.current = {};
    bucketPreviewOrderRef.current = {};
    touchDragOriginRef.current = null;
    touchDragTargetRef.current = null;
    touchDragDateRef.current = null;
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    if (mobilePreviewRafRef.current !== null) {
      cancelAnimationFrame(mobilePreviewRafRef.current);
      mobilePreviewRafRef.current = null;
    }
    if (bucketPreviewRafRef.current !== null) {
      cancelAnimationFrame(bucketPreviewRafRef.current);
      bucketPreviewRafRef.current = null;
    }
    clearMeasurementCaches();
    stopAutoScroll();
  }, [clearMeasurementCaches, stopAutoScroll]);

  const getBucketOrderedIds = (
    bucket: Extract<Bucket, 'inbox' | 'later'>,
    excludeId?: string,
  ): string[] => {
    const items = bucket === 'inbox' ? inboxActivities : laterActivities;
    return items.filter((activity) => activity.id !== excludeId).map((activity) => activity.id);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', activity.id);
    setDraggingId(activity.id);
    setDragOverKey(null);

    const target = event.currentTarget;
    if (target) {
      setDraggedCardHeight(target.offsetHeight);
    }
  };

  const handleDragEnd = () => {
    resetDragState();
  };

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

  const clearDragKey = (key: string) => {
    if (dragOverKey === key) {
      setDragOverKey(null);
    }
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
      clearDragKey(key);
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const getFlexibleIdsForDate = (date: string, excludeId?: string): string[] => {
    const itemsForDay = weekActivities[date] ?? [];
    return itemsForDay
      .filter((activity) => activity.time === null && activity.id !== excludeId)
      .map((activity) => activity.id);
  };

  const handleDropOnDay = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
    targetIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const droppedId = draggingId ?? event.dataTransfer.getData('text/plain');
    const activity = findActivityById(droppedId);

    if (!activity) {
      resetDragState();
      return;
    }

    const sourceDate = activity.bucket === 'scheduled' ? activity.date : null;
    const isFlexible = activity.time === null;

    if (activity.bucket !== 'scheduled' || activity.date !== date) {
      scheduleActivity(activity.id, date);
    }

    const currentDayItems = weekActivities[date] ?? [];
    const currentIndex = currentDayItems.findIndex((item) => item.id === activity.id);
    let adjustedIndex = targetIndex;
    if (sourceDate === date && currentIndex >= 0) {
      if (targetIndex > currentIndex) {
        adjustedIndex = targetIndex - 1;
      }
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

    const orderedIds = finalOrder.map((item, index) => ({ id: item.id, idx: index }));
    orderedIds.sort((a, b) => a.idx - b.idx);
    reorderInDay(
      date,
      orderedIds.map((o) => o.id),
    );

    if (isFlexible && sourceDate && sourceDate !== date) {
      const remainingSource = getFlexibleIdsForDate(sourceDate, activity.id);
      reorderInDay(sourceDate, remainingSource);
    } else if (!isFlexible && sourceDate && sourceDate !== date) {
      const remainingSource = getFlexibleIdsForDate(sourceDate, activity.id);
      reorderInDay(sourceDate, remainingSource);
    }

    resetDragState();
  };

  const handleDropToBucket = (
    event: React.DragEvent<HTMLElement>,
    bucket: Extract<Bucket, 'inbox' | 'later'>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const droppedId = draggingId ?? event.dataTransfer.getData('text/plain');
    const activity = findActivityById(droppedId);

    if (!activity) {
      resetDragState();
      return;
    }

    const sourceDate = activity.bucket === 'scheduled' ? activity.date : null;
    const isFlexibleScheduled = activity.bucket === 'scheduled' && activity.time === null;

    if (bucket === 'inbox') {
      moveToInbox(activity.id);
    } else {
      moveToLater(activity.id);
    }

    const orderedIds = getBucketOrderedIds(bucket, activity.id);
    const clampedIndex = Math.min(Math.max(targetIndex, 0), orderedIds.length);
    orderedIds.splice(clampedIndex, 0, activity.id);
    reorderInBucket(bucket, orderedIds);

    if (isFlexibleScheduled && sourceDate) {
      const remainingSource = getFlexibleIdsForDate(sourceDate, activity.id);
      reorderInDay(sourceDate, remainingSource);
    }

    resetDragState();
  };

  // Mobile drag handlers
  const handleMobileDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
    targetIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }

    if (draggingId) {
      const activitiesForDay = weekActivities[date] ?? [];
      const newOrder = computeAnchoredPreviewOrder(activitiesForDay, draggingId, targetIndex);
      updateMobilePreview(date, newOrder);
      scheduleMeasurement('day', date);
    }
  };

  const handleMobileDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
    }
    dragLeaveTimeoutRef.current = window.setTimeout(() => {
      updateMobilePreview(null, null);
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const handleMobileDrop = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
    targetIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedId = draggingId ?? event.dataTransfer.getData('text/plain');
    const activity = findActivityById(droppedId);

    if (!activity) {
      resetDragState();
      return;
    }

    const activitiesForDay = weekActivities[date] ?? [];
    const finalOrder = computeAnchoredPreviewOrder(activitiesForDay, droppedId, targetIndex);
    const orderedIds = finalOrder.map((a) => a.id);
    reorderInDay(date, orderedIds);

    resetDragState();
  };

  // Touch drag handlers for mobile/tablet week view
  const findIndexFromMidpoints = useCallback((midpoints: number[], clientY: number) => {
    let low = 0;
    let high = midpoints.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (clientY > midpoints[mid]) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }, []);

  const getMobileTargetIndexFromY = useCallback(
    (clientY: number, date: string): number => {
      if (!dayMidpointsRef.current[date]) {
        measureDayMidpoints(date);
      }
      const midpoints = dayMidpointsRef.current[date] ?? [];
      if (midpoints.length === 0) return 0;
      return findIndexFromMidpoints(midpoints, clientY);
    },
    [findIndexFromMidpoints, measureDayMidpoints],
  );

  const getBucketTargetIndexFromY = useCallback(
    (
      clientY: number,
      columnKey: string,
    ): { bucket: Extract<Bucket, 'inbox' | 'later'>; index: number } | null => {
      const meta = bucketColumnMetaRef.current[columnKey];
      if (!meta) return null;
      if (!bucketMidpointsRef.current[columnKey]) {
        measureBucketMidpoints(columnKey);
      }
      const midpoints = bucketMidpointsRef.current[columnKey] ?? [];
      const targetIndex = findIndexFromMidpoints(midpoints, clientY);
      return { bucket: meta.bucket, index: meta.startIndex + targetIndex };
    },
    [findIndexFromMidpoints, measureBucketMidpoints],
  );

  const getTouchTargetAtPosition = useCallback(
    (clientX: number, clientY: number): TouchTarget | null => {
      // Use cached rects to avoid layout thrashing
      for (const date of weekDates) {
        const rect = cachedDateRectsRef.current[date];
        if (rect) {
          if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          ) {
            return { type: 'day', date };
          }
        }
      }

      for (const [columnKey, rect] of Object.entries(cachedBucketRectsRef.current)) {
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          const meta = bucketColumnMetaRef.current[columnKey];
          if (meta) {
            return { type: 'bucket', bucket: meta.bucket, columnKey };
          }
        }
      }

      return null;
    },
    [weekDates],
  );

  const touchDnd = useTouchDragAndDrop<TouchTarget>({
    enabled: prefersTouchDrag,
    overlayRef,
    scrollLock: {
      getScrollContainer: () => scrollContainer,
    },
    onDragStart: ({ id, meta, rect }) => {
      setDraggedCardHeight(rect.height);
      setDraggingId(id);
      setIsTouchDrag(true);
      touchDragOriginRef.current = meta;
      touchDragTargetRef.current = meta;
      touchDragDateRef.current = meta.type === 'day' ? meta.date : null;
      mobilePreviewOrderRef.current = {};
      bucketPreviewOrderRef.current = {};
      setMobilePreviewOrder({});
      setBucketPreviewOrder({});
      setMobileDragOverDate(meta.type === 'day' ? meta.date : null);
      clearMeasurementCaches();

      cachedDateRectsRef.current = {};
      for (const d of weekDates) {
        const container = mobileContainerRefs.current[d];
        if (container) {
          cachedDateRectsRef.current[d] = container.getBoundingClientRect();
        }
      }
      cachedBucketRectsRef.current = {};
      Object.entries(bucketContainerRefs.current).forEach(([key, container]) => {
        if (container) {
          cachedBucketRectsRef.current[key] = container.getBoundingClientRect();
        }
      });
      if (meta.type === 'day') {
        scheduleMeasurement('day', meta.date);
      } else {
        scheduleMeasurement('bucket', meta.columnKey);
      }
    },
    onDragMove: ({ id, clientX, clientY }) => {
      const detectedTarget =
        getTouchTargetAtPosition(clientX, clientY) ?? touchDragTargetRef.current;

      if (detectedTarget) {
        touchDragTargetRef.current = detectedTarget;
      }

      const activity = findActivityById(id);
      if (!activity) return;

      if (detectedTarget?.type === 'day') {
        const targetDate = detectedTarget.date;
        touchDragDateRef.current = targetDate;
        const now = Date.now();
        if (now - lastDateUpdateRef.current > 50) {
          lastDateUpdateRef.current = now;
          setMobileDragOverDate(targetDate);
        }

        const targetIndex = getMobileTargetIndexFromY(clientY, targetDate);
        const activitiesForDay = weekActivities[targetDate] ?? [];
        const preview =
          activity.bucket === 'scheduled' && activity.date === targetDate
            ? computeAnchoredPreviewOrder(activitiesForDay, id, targetIndex)
            : computePlaceholderPreview(activitiesForDay, activity, targetIndex);

        updateMobilePreview(targetDate, preview);
        updateBucketPreview(null, null);
        scheduleMeasurement('day', targetDate);
      } else if (detectedTarget?.type === 'bucket') {
        setMobileDragOverDate(null);
        const targetMeta = getBucketTargetIndexFromY(clientY, detectedTarget.columnKey);
        if (!targetMeta) return;
        touchDragDateRef.current = null;

        const targetList = targetMeta.bucket === 'inbox' ? inboxActivities : laterActivities;
        const preview =
          activity.bucket === targetMeta.bucket
            ? computeAnchoredPreviewOrder(targetList, id, targetMeta.index)
            : computePlaceholderPreview(targetList, activity, targetMeta.index);

        updateBucketPreview(targetMeta.bucket, preview);
        updateMobilePreview(null, null);
        scheduleMeasurement('bucket', detectedTarget.columnKey);
      } else {
        setMobileDragOverDate(null);
        updateMobilePreview(null, null);
        updateBucketPreview(null, null);
      }

      startAutoScroll(clientY);
    },
    onDragEnd: ({ id, cancelled }) => {
      if (!cancelled) {
        const activity = findActivityById(id);
        const target = touchDragTargetRef.current;
        if (activity && target?.type === 'day') {
          const targetDate = target.date;
          const preview = mobilePreviewOrderRef.current[targetDate];
          if (preview) {
            if (!(activity.bucket === 'scheduled' && activity.date === targetDate)) {
              scheduleActivity(id, targetDate);
            }

            const orderedIds = preview.map((a) => (a.id === DRAG_PLACEHOLDER_ID ? id : a.id));
            reorderInDay(targetDate, orderedIds);

            const origin = touchDragOriginRef.current;
            const movedFromOtherDay = origin?.type === 'day' && origin.date !== targetDate;
            if (movedFromOtherDay && activity.bucket === 'scheduled') {
              const remainingSource = getFlexibleIdsForDate(origin.date, activity.id);
              reorderInDay(origin.date, remainingSource);
            }
          }
        } else if (activity && target?.type === 'bucket') {
          const preview = bucketPreviewOrderRef.current[target.bucket];
          if (preview) {
            if (target.bucket === 'inbox') {
              moveToInbox(activity.id);
            } else {
              moveToLater(activity.id);
            }

            const finalOrderedIds = preview.map((a) => (a.id === DRAG_PLACEHOLDER_ID ? id : a.id));
            reorderInBucket(target.bucket, finalOrderedIds);

            const origin = touchDragOriginRef.current;
            if (origin?.type === 'day' && activity.bucket === 'scheduled') {
              const remainingSource = getFlexibleIdsForDate(origin.date, activity.id);
              reorderInDay(origin.date, remainingSource);
            }
          }
        }
      }

      touchDragDateRef.current = null;
      mobilePreviewOrderRef.current = {};
      bucketPreviewOrderRef.current = {};
      setIsTouchDrag(false);
      setMobileDragOverDate(null);
      stopAutoScroll();
      resetDragState();
    },
  });

  const renderBucketColumn = (
    label: string,
    bucketActivities: Activity[],
    placement: Extract<Bucket, 'inbox' | 'later'>,
    showLabel: boolean,
    totalCount: number,
    startIndex: number,
    columnIndex: number,
  ) => {
    const COLUMN_HEIGHT = 5;
    const placeholderCount = Math.max(COLUMN_HEIGHT - bucketActivities.length, 0);
    let zoneIndex = startIndex;
    const isPrimaryColumn = columnIndex === 0;
    const columnHasItems = bucketActivities.length > 0;
    const isSecondaryEmpty = !isPrimaryColumn && !columnHasItems;
    const appendKey = makeBucketZoneKey(placement, totalCount);
    const ownsAppendHighlight = appendKey !== null && isPrimaryColumn;
    const interactionsEnabled = isPrimaryColumn || columnHasItems || isSecondaryEmpty;
    const columnKey = `${placement}-${columnIndex}`;

    return (
      <div
        className="flex min-h-64 flex-col gap-2 px-1 py-3"
        ref={(el) => {
          bucketContainerRefs.current[columnKey] = el;
          bucketColumnMetaRef.current[columnKey] = { bucket: placement, startIndex };
        }}
        onDragOver={
          enablePointerDrag && interactionsEnabled
            ? (event) => handleDragOverZone(event, appendKey)
            : undefined
        }
        onDragLeave={
          enablePointerDrag && interactionsEnabled
            ? (event) => handleDragLeaveZone(event, appendKey)
            : undefined
        }
        onDrop={
          enablePointerDrag && interactionsEnabled
            ? (event) => handleDropToBucket(event, placement, startIndex + bucketActivities.length)
            : undefined
        }
      >
        <div className="flex items-baseline justify-between gap-2 px-1">
          <div
            className={`text-base font-semibold text-[var(--color-text-primary)] ${
              showLabel ? '' : 'text-transparent'
            }`}
            aria-hidden={!showLabel}
          >
            {showLabel ? label : 'Placeholder'}
          </div>
          {showLabel ? (
            <div className="text-base text-[var(--color-text-meta)] mr-3">
              {totalCount > 0 ? totalCount : ''}
            </div>
          ) : (
            <div aria-hidden className="text-base text-transparent mr-3">
              0
            </div>
          )}
        </div>
        <div>
          {bucketActivities.map((activity) =>
            (() => {
              const dropIndex = zoneIndex;
              const zoneKey = makeBucketZoneKey(placement, dropIndex);
              zoneIndex += 1;
              const isAppendHighlight =
                ownsAppendHighlight && dragOverKey === appendKey && dropIndex === totalCount;
              const dividerActive =
                !isSecondaryEmpty && (dragOverKey === zoneKey || isAppendHighlight);
              return (
                <motion.div
                  layout
                  initial={false}
                  transition={FAST_TRANSITION}
                  key={`${columnKey}-${activity.id}`}
                  data-activity-id={activity.id}
                >
                  <Divider
                    isActive={dividerActive}
                    onDragOver={
                      enablePointerDrag ? (event) => handleDragOverZone(event, zoneKey) : undefined
                    }
                    onDragLeave={
                      enablePointerDrag ? (event) => handleDragLeaveZone(event, zoneKey) : undefined
                    }
                    onDrop={
                      enablePointerDrag
                        ? (event) => handleDropToBucket(event, placement, dropIndex)
                        : undefined
                    }
                  />
                  {activity.id === DRAG_PLACEHOLDER_ID ? (
                    <div style={{ height: `${draggedCardHeight}px` }} />
                  ) : (
                    <WeekActivityRow
                      activity={activity}
                      onToggleDone={handleToggleDone}
                      onEdit={handleEdit}
                      draggable={enablePointerDrag}
                      disableHover={draggingId !== null}
                      onDragStart={
                        enablePointerDrag ? (event) => handleDragStart(event, activity) : undefined
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
                          ? (event) => handleDropToBucket(event, placement, dropIndex)
                          : undefined
                      }
                      onTouchStart={
                        prefersTouchDrag
                          ? touchDnd.getTouchStartProps(activity.id, {
                              type: 'bucket',
                              bucket: placement,
                              columnKey,
                            }).onTouchStart
                          : undefined
                      }
                    />
                  )}
                </motion.div>
              );
            })(),
          )}
          {Array.from({ length: placeholderCount }).map((_, idx) => (
            <div key={`${placement}-placeholder-${idx}`}>
              {(() => {
                const dropIndex = zoneIndex;
                const zoneKey = makeBucketZoneKey(placement, dropIndex);
                zoneIndex += 1;
                const isPrimaryDrop = idx === 0;
                const isAppendHighlight =
                  ownsAppendHighlight && dragOverKey === appendKey && dropIndex === totalCount;
                const activeKey = isSecondaryEmpty ? null : isPrimaryDrop ? appendKey : zoneKey;
                const handlerKey = isSecondaryEmpty ? appendKey : activeKey;
                if (!interactionsEnabled) {
                  return (
                    <>
                      <Divider />
                      <div className="min-h-[38px]" />
                    </>
                  );
                }
                return isPrimaryDrop ? (
                  <>
                    <Divider
                      isActive={
                        activeKey !== null &&
                        !isSecondaryEmpty &&
                        (dragOverKey === activeKey || isAppendHighlight)
                      }
                      onDragOver={
                        enablePointerDrag && handlerKey
                          ? (event) => handleDragOverZone(event, handlerKey)
                          : undefined
                      }
                      onDragLeave={
                        enablePointerDrag && handlerKey
                          ? (event) => handleDragLeaveZone(event, handlerKey)
                          : undefined
                      }
                      onDrop={
                        enablePointerDrag && handlerKey
                          ? (event) => handleDropToBucket(event, placement, dropIndex)
                          : undefined
                      }
                    />
                    <div
                      onDragOver={
                        enablePointerDrag && handlerKey
                          ? (event) => handleDragOverZone(event, handlerKey)
                          : undefined
                      }
                      onDragLeave={
                        enablePointerDrag && handlerKey
                          ? (event) => handleDragLeaveZone(event, handlerKey)
                          : undefined
                      }
                      onDrop={
                        enablePointerDrag && handlerKey
                          ? (event) => handleDropToBucket(event, placement, dropIndex)
                          : undefined
                      }
                    >
                      <EmptySlot onClick={() => handleOpenCreateModal({ placement })} />
                    </div>
                  </>
                ) : (
                  <>
                    <Divider />
                    <div className="min-h-[38px]" />
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDesktopDayColumn = (date: string, targetSlotCount: number) => {
    const activitiesForDay = weekActivities[date] ?? [];
    const displayActivitiesForDay = prefersTouchDrag
      ? (mobilePreviewOrder[date] ?? activitiesForDay)
      : activitiesForDay;
    const { weekday, monthDay } = formatDesktopDayLabel(date);
    const isToday = date === todayIso;
    let zoneIndex = 0;
    const appendKey = makeDayAppendKey(date);
    const totalSlots = Math.max(targetSlotCount - displayActivitiesForDay.length, 1);

    return (
      <div key={date} className="flex min-h-64 flex-col gap-2 px-1 py-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 text-base font-semibold text-[var(--color-text-primary)]">
            {weekday}
            {isToday && <FlagTriangleRight className="h-3.5 w-3.5" />}
          </div>
          <div className="text-base text-[var(--color-text-meta)] mr-3">{monthDay}</div>
        </div>
        <div
          ref={(el) => {
            mobileContainerRefs.current[date] = el;
          }}
          onDragOver={
            enablePointerDrag ? (event) => handleDragOverZone(event, appendKey) : undefined
          }
          onDragLeave={
            enablePointerDrag ? (event) => handleDragLeaveZone(event, appendKey) : undefined
          }
          onDrop={
            enablePointerDrag ? (event) => handleDropOnDay(event, date, zoneIndex) : undefined
          }
        >
          <>
            {displayActivitiesForDay.map((activity) => {
              const dropIndex = zoneIndex;
              const zoneKey = makeDayZoneKey(date, zoneIndex);
              zoneIndex += 1;
              const isPlaceholder = activity.id === DRAG_PLACEHOLDER_ID;

              return (
                <motion.div
                  layout
                  initial={false}
                  transition={FAST_TRANSITION}
                  key={`${date}-${activity.id}`}
                  data-activity-id={activity.id}
                >
                  <Divider
                    isActive={dragOverKey === zoneKey}
                    onDragOver={
                      enablePointerDrag ? (event) => handleDragOverZone(event, zoneKey) : undefined
                    }
                    onDragLeave={
                      enablePointerDrag ? (event) => handleDragLeaveZone(event, zoneKey) : undefined
                    }
                    onDrop={
                      enablePointerDrag
                        ? (event) => handleDropOnDay(event, date, dropIndex)
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
                      onDragStart={
                        enablePointerDrag ? (event) => handleDragStart(event, activity) : undefined
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
                          ? (event) => handleDropOnDay(event, date, dropIndex)
                          : undefined
                      }
                      onTouchStart={
                        prefersTouchDrag
                          ? touchDnd.getTouchStartProps(activity.id, { type: 'day', date })
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
              const zoneKey = makeDayZoneKey(date, zoneIndex);

              zoneIndex += 1;

              const isPrimaryDrop = idx === 0;
              const activeKey = isPrimaryDrop ? appendKey : zoneKey;
              return (
                <div key={`placeholder-${date}-${idx}`}>
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
                            ? (event) => handleDropOnDay(event, date, dropIndex)
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
                            ? (event) => handleDropOnDay(event, date, dropIndex)
                            : undefined
                        }
                      >
                        <EmptySlot onClick={() => handleOpenCreateModal({ date })} />
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
  };

  const formattedMonthYear = useMemo(() => {
    if (!activeDate) return '';
    const date = new Date(`${activeDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return activeDate;
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [activeDate]);

  return (
    <>
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={weekStartDate}
          custom={direction}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={FAST_TRANSITION}
          className="w-full"
        >
          {!isDesktop && (
            <div className="space-y-8 px-4 pt-4 pb-4">
              {weekDates.map((date) => {
                const activitiesForDay = weekActivities[date] ?? [];
                const displayActivities = mobilePreviewOrder[date] ?? activitiesForDay;
                const mobileLabel = formatMobileDayLabel(date);
                const isToday = date === todayIso;

                return (
                  <section key={date} className="space-y-2">
                    <div className="flex items-center justify-between text-base font-semibold">
                      <div className="flex items-center gap-1.5 text-left text-[var(--color-text-primary)]">
                        <span>{mobileLabel.weekday}</span>
                        {isToday && <FlagTriangleRight className="h-3.5 w-3.5" />}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal({ date })}
                        className="text-right text-[var(--color-text-meta)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
                        aria-label={`Add activity on ${mobileLabel.weekday} ${mobileLabel.monthDay}`}
                      >
                        {mobileLabel.monthDay}
                      </button>
                    </div>
                    <Divider />
                    <div
                      ref={(el) => {
                        mobileContainerRefs.current[date] = el;
                      }}
                      className="min-h-20 relative"
                      onDragLeave={handleMobileDragLeave}
                      onDragOver={(e) => handleMobileDragOver(e, date, displayActivities.length)}
                      onDrop={(e) => handleMobileDrop(e, date, displayActivities.length)}
                    >
                      {displayActivities.length === 0 && mobileDragOverDate !== date && (
                        <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
                          <div className="w-full pt-6">
                            <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                            <div className="h-[32px]" />
                            <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                          </div>
                        </div>
                      )}
                      {displayActivities.map((activity, index) => (
                        <motion.div
                          layout
                          initial={false}
                          transition={FAST_TRANSITION}
                          key={activity.id}
                          data-activity-id={activity.id}
                          onDragOver={(e) => handleMobileDragOver(e, date, index)}
                          onDrop={(e) => handleMobileDrop(e, date, index)}
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
                                touchDnd.getTouchStartProps(activity.id, { type: 'day', date })
                                  .onTouchStart
                              }
                            />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {isDesktopNarrow && (
            <div className="w-full">
              <h1 className="mx-auto w-full max-w-xl bg-[var(--color-surface)] px-4 pb-3">
                <button
                  type="button"
                  onClick={onResetToday}
                  className="text-xl font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
                >
                  {formattedMonthYear}
                </button>
              </h1>
              <div className="mx-auto w-full max-w-xl px-4 pb-6">
                <div className="space-y-6">
                  {weekDates.map((date) => renderDesktopDayColumn(date, 5))}
                </div>
              </div>
            </div>
          )}

          {isWideDesktop && (
            <div className="w-full">
              <h1 className="mx-auto w-full bg-[var(--color-surface)] px-3 pb-3 pl-4">
                <button
                  type="button"
                  onClick={onResetToday}
                  className="text-xl font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
                >
                  {formattedMonthYear}
                </button>
              </h1>
              <div className="mx-auto w-full px-3">
                <div className="grid grid-cols-6 gap-0">
                  {topWeekDates.map((date) => renderDesktopDayColumn(date, desktopMaxDividerCount))}
                </div>
                {extraDate && (
                  <div className="mt-10 grid grid-cols-6 gap-0">
                    <div>
                      {renderBucketColumn(
                        'Inbox',
                        inboxPrimary,
                        'inbox',
                        true,
                        displayInboxActivities.length,
                        0,
                        0,
                      )}
                    </div>
                    <div>
                      {renderBucketColumn(
                        'Inbox',
                        inboxSecondary,
                        'inbox',
                        false,
                        displayInboxActivities.length,
                        inboxPrimary.length,
                        1,
                      )}
                    </div>
                    <div>
                      {renderBucketColumn(
                        'Later',
                        laterPrimary,
                        'later',
                        true,
                        displayLaterActivities.length,
                        0,
                        0,
                      )}
                    </div>
                    <div>
                      {renderBucketColumn(
                        'Later',
                        laterSecondary,
                        'later',
                        false,
                        displayLaterActivities.length,
                        laterPrimary.length,
                        1,
                      )}
                    </div>
                    <div className="min-h-64" aria-hidden />
                    <div>{renderDesktopDayColumn(extraDate, 5)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

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
        initialPlacement={newActivityPlacement}
        defaultDate={newActivityDate ?? activeDate}
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
                <div className="shadow-xl rounded-xl bg-[var(--color-surface)]">
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

export default WeekPage;
