import { useMemo, useState } from "react";
import ActivityCard from "../day/ActivityCard";
import { useActivitiesStore } from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";
import WeekActivityRow from "./WeekActivityRow";
import {
  getWeekActivities,
  getWeekDates,
  getWeekStartDate,
} from "./weekSelectors";

interface WeekPageProps {
  activeDate: string;
}

const PLACEHOLDER_ACTIVITY: Activity = {
  id: "placeholder",
  title: "Placeholder",
  bucket: "scheduled",
  date: null,
  time: null,
  durationMinutes: null,
  repeat: "none",
  note: null,
  isDone: false,
  orderIndex: null,
  createdAt: "",
  updatedAt: "",
};

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
  const PlaceholderRow = () => (
    <div className="invisible pointer-events-none select-none" aria-hidden>
      <WeekActivityRow
        activity={PLACEHOLDER_ACTIVITY}
        onToggleDone={() => {}}
        onEdit={() => {}}
      />
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

      {/* Desktop grid (Sunday under Saturday) */}
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
                          {Array.from({ length: placeholderCount }).map((_, idx) => (
                            <div key={`placeholder-${idx}`}>
                              <Divider />
                              <PlaceholderRow />
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
            <div className="mt-10 grid grid-cols-6">
              <div className="col-start-6">
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
                              {Array.from({ length: placeholderCount }).map((_, idx) => (
                                <div key={`sunday-placeholder-${idx}`}>
                                  <Divider />
                                  <PlaceholderRow />
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
    </>
  );
};

export default WeekPage;
