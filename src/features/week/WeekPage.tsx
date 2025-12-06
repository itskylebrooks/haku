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
  const weekActivities = useMemo(
    () => getWeekActivities(activities, weekStartDate),
    [activities, weekStartDate]
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
                  <div className="flex justify-center pt-4 pb-3">
                    <div className="w-12 border-t border-[var(--color-border-divider)]" />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Desktop 7-column grid */}
      <div className="hidden md:block">
        <div className="mx-auto w-full px-3 pt-4">
          <div className="grid grid-cols-7 gap-0 divide-x divide-[var(--color-border-divider)]">
            {weekDates.map((date) => {
              const activitiesForDay = weekActivities[date] ?? [];
              const { weekday, monthDay } = formatDesktopDayLabel(date);

              return (
                <div
                  key={date}
                  className="flex flex-col gap-3 px-1 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {weekday}
                    </div>
                    <div className="text-sm text-[var(--color-text-meta)]">{monthDay}</div>
                  </div>
                  <div className="space-y-0.5">
                    {activitiesForDay.map((activity) => (
                      <WeekActivityRow
                        key={activity.id}
                        activity={activity}
                        onToggleDone={handleToggleDone}
                        onEdit={handleEdit}
                      />
                    ))}
                    {activitiesForDay.length === 0 && (
                      <div className="mt-1 flex justify-center px-1 pt-4 pb-3">
                        <div className="w-10 border-t border-[var(--color-border-divider)]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
