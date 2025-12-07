import { useMemo, useState } from "react";
import { CirclePlus } from "lucide-react";
import ActivityCard from "../day/ActivityCard";
import { useActivitiesStore, getInboxActivities, getLaterActivities } from "../../shared/store/activitiesStore";
import type { Activity, Bucket } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";
import WeekActivityRow from "./WeekActivityRow";
import {
  getWeekActivities,
  getWeekDates,
  getWeekStartDate,
} from "./weekSelectors";
import { distributeIntoTwoColumns } from "./columnDistribution";

interface WeekPageProps {
  activeDate: string;
}

const formatMobileDayLabel = (isoDate: string): { weekday: string; monthDay: string } => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { weekday: isoDate, monthDay: "" };

  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { weekday, monthDay };
};

const formatDesktopDayLabel = (isoDate: string): { weekday: string; monthDay: string } => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { weekday: isoDate, monthDay: "" };
  }

  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { weekday, monthDay };
};

const WeekPage = ({ activeDate }: WeekPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newActivityDate, setNewActivityDate] = useState<string | null>(null);
  const [newActivityPlacement, setNewActivityPlacement] = useState<Bucket>("scheduled");

  const weekStartDate = useMemo(
    () => getWeekStartDate(activeDate),
    [activeDate]
  );
  const weekDates = useMemo(
    () => getWeekDates(weekStartDate),
    [weekStartDate]
  );
  const weekDatesWithoutSunday = useMemo(
    () => weekDates.filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() !== 0),
    [weekDates]
  );
  const sundayDate = useMemo(
    () => weekDates.find((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 0),
    [weekDates]
  );
  const weekActivities = useMemo(
    () => getWeekActivities(activities, weekStartDate),
    [activities, weekStartDate]
  );
  const inboxActivities = useMemo(
    () => getInboxActivities(activities),
    [activities]
  );
  const laterActivities = useMemo(
    () => getLaterActivities(activities),
    [activities]
  );
  const [inboxPrimary, inboxSecondary] = useMemo(
    () => distributeIntoTwoColumns(inboxActivities),
    [inboxActivities]
  );
  const [laterPrimary, laterSecondary] = useMemo(
    () => distributeIntoTwoColumns(laterActivities),
    [laterActivities]
  );
  const desktopMaxDividerCount = useMemo(() => {
    const counts = weekDatesWithoutSunday.map((date) => weekActivities[date]?.length ?? 0);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    return Math.max(5, maxCount);
  }, [weekActivities, weekDatesWithoutSunday]);

  const Divider = () => (
    <div className="flex h-[2px] items-center px-1">
      <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
    </div>
  );
  
  const EmptySlot = ({ onClick, label = "New activity" }: { onClick: () => void; label?: string }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group/empty flex min-h-[38px] items-center rounded-lg px-1.5 py-1 cursor-pointer transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
    >
      <div className="flex min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--color-text-meta)] opacity-0 group-hover/empty:opacity-100 transition-opacity">
          {label}
        </p>
      </div>
      <div className="flex-shrink-0 opacity-0 group-hover/empty:opacity-100 transition-opacity">
        <CirclePlus className="h-4 w-4 text-[var(--color-text-meta)]" />
      </div>
    </div>
  );

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
    setNewActivityPlacement("scheduled");
  };

  const handleOpenCreateModal = ({
    date = null,
    placement = "scheduled",
  }: {
    date?: string | null;
    placement?: Bucket;
  }) => {
    setNewActivityDate(date);
    setNewActivityPlacement(placement);
    setIsCreateModalOpen(true);
  };

  const renderBucketColumn = (
    label: string,
    bucketActivities: Activity[],
    placement: Bucket,
    showLabel: boolean,
    totalCount: number
  ) => {
    const COLUMN_HEIGHT = 5;
    const placeholderCount = Math.max(COLUMN_HEIGHT - bucketActivities.length, 0);

    return (
      <div className="flex min-h-64 flex-col gap-2 px-1 py-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <div
            className={`text-sm font-semibold text-[var(--color-text-primary)] ${
              showLabel ? "" : "text-transparent"
            }`}
            aria-hidden={!showLabel}
          >
            {showLabel ? label : "Placeholder"}
          </div>
          {showLabel ? (
            <div className="text-xs text-[var(--color-text-meta)]">
              {totalCount > 0 ? totalCount : ""}
            </div>
          ) : (
            <div aria-hidden className="text-xs text-transparent">0</div>
          )}
        </div>
        <div>
          {bucketActivities.map((activity) => (
            <div key={activity.id}>
              <Divider />
              <WeekActivityRow
                activity={activity}
                onToggleDone={handleToggleDone}
                onEdit={handleEdit}
              />
            </div>
          ))}
          {Array.from({ length: placeholderCount }).map((_, idx) => (
            <div key={`${placement}-placeholder-${idx}`}>
              <Divider />
              {idx === 0 ? (
                <EmptySlot
                  label={`Add to ${label}`}
                  onClick={() => handleOpenCreateModal({ placement })}
                />
              ) : (
                <div className="min-h-[38px]" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile stacked week */}
      <div className="md:hidden">
        <div className="space-y-8 px-4 pt-4 pb-6">
          {weekDates.map((date) => {
            const activitiesForDay = weekActivities[date] ?? [];
            const hasActivities = activitiesForDay.length > 0;
            const mobileLabel = formatMobileDayLabel(date);

            return (
              <section key={date} className="space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-1 text-center text-sm font-semibold">
                  <span className="text-[var(--color-text-primary)]">{mobileLabel.weekday}</span>
                  <span className="text-[var(--color-text-meta)]">· {mobileLabel.monthDay}</span>
                </div>
                {hasActivities ? (
                  <div className="space-y-2">
                    {activitiesForDay.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        onToggleDone={handleToggleDone}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pt-4 pb-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div key={idx} className="flex h-7 items-center">
                        <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Desktop grid with Sunday + Inbox/Later row */}
      <div className="hidden md:block">
        <div className="mx-auto w-full px-3 pt-4">
          <div className="grid grid-cols-6 gap-0">
            {weekDatesWithoutSunday.map((date) => {
              const activitiesForDay = weekActivities[date] ?? [];
              const { weekday, monthDay } = formatDesktopDayLabel(date);

              return (
                <div
                  key={date}
                  className="flex min-h-64 flex-col gap-2 px-1 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {weekday}
                    </div>
                    <div className="text-sm text-[var(--color-text-meta)]">{monthDay}</div>
                  </div>
                  <div>
                    {(() => {
                      const placeholderCount = Math.max(
                        desktopMaxDividerCount - activitiesForDay.length,
                        0
                      );
                      // Ensure at least 1 slot for "Add activity" even if list is full
                      const totalSlots = Math.max(placeholderCount, 1);

                      return (
                        <>
                          {activitiesForDay.map((activity) => (
                            <div key={activity.id}>
                              <Divider />
                              <WeekActivityRow
                                activity={activity}
                                onToggleDone={handleToggleDone}
                                onEdit={handleEdit}
                              />
                            </div>
                          ))}
                          {Array.from({ length: totalSlots }).map((_, idx) => (
                            <div key={`placeholder-${idx}`}>
                              <Divider />
                              {idx === 0 ? (
                                <EmptySlot onClick={() => handleOpenCreateModal({ date })} />
                              ) : (
                                <div className="min-h-[38px]" />
                              )}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          {sundayDate && (
            <div className="mt-10 grid grid-cols-6 gap-0">
              <div>
                {renderBucketColumn("Inbox", inboxPrimary, "inbox", true, inboxActivities.length)}
              </div>
              <div>
                {renderBucketColumn("Inbox", inboxSecondary, "inbox", false, inboxActivities.length)}
              </div>
              <div>
                {renderBucketColumn("Later", laterPrimary, "later", true, laterActivities.length)}
              </div>
              <div>
                {renderBucketColumn("Later", laterSecondary, "later", false, laterActivities.length)}
              </div>
              <div className="min-h-64" aria-hidden />
              <div>
                {(() => {
                  const activitiesForDay = weekActivities[sundayDate] ?? [];
                  const { weekday, monthDay } = formatDesktopDayLabel(sundayDate);
                  return (
                    <div className="flex min-h-64 flex-col gap-2 px-1 py-3">
                      <div className="flex items-baseline justify-between gap-2 px-1">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {weekday}
                        </div>
                        <div className="text-sm text-[var(--color-text-meta)]">{monthDay}</div>
                      </div>
                      <div>
                        {(() => {
                          const placeholderCount = Math.max(5 - activitiesForDay.length, 0);
                          // Ensure at least 1 slot for "Add activity" even if list is full
                          const totalSlots = Math.max(placeholderCount, 1);

                          return (
                            <>
                              {activitiesForDay.map((activity) => (
                                <div key={activity.id}>
                                  <Divider />
                                  <WeekActivityRow
                                    activity={activity}
                                    onToggleDone={handleToggleDone}
                                    onEdit={handleEdit}
                                  />
                                </div>
                              ))}
                              {Array.from({ length: totalSlots }).map((_, idx) => (
                                <div key={`sunday-placeholder-${idx}`}>
                                  <Divider />
                                  {idx === 0 ? (
                                    <EmptySlot
                                      onClick={() => handleOpenCreateModal({ date: sundayDate })}
                                    />
                                  ) : (
                                    <div className="min-h-[38px]" />
                                  )}
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
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
        initialPlacement={newActivityPlacement}
        defaultDate={newActivityDate ?? activeDate}
      />
    </>
  );
};

export default WeekPage;
