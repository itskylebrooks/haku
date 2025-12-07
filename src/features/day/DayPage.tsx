import { useMemo, useState } from "react";
import { useActivitiesStore } from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import ActivityCard from "./ActivityCard";
import { getDayViewData } from "./daySelectors";
import AddActivityModal from "../../shared/components/AddActivityModal";

interface DayPageProps {
  activeDate: string;
}

const DayPage = ({ activeDate }: DayPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);

  const { overdue, todayAnchored, todayFlexible } = useMemo(
    () => getDayViewData(activities, activeDate),
    [activities, activeDate]
  );

  const todayActivities = useMemo(
    () => [...todayAnchored, ...todayFlexible],
    [todayAnchored, todayFlexible]
  );

  const hasOverdue = overdue.length > 0;
  const hasTodayActivities = todayActivities.length > 0;
  const isEmpty = !hasOverdue && !hasTodayActivities;

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
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        {/* Empty state */}
        {isEmpty && (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--color-text-subtle)]">
              No activities for this day yet.
            </p>
          </div>
        )}

        {/* Overdue section */}
        {hasOverdue && (
          <div className="mb-4">
            <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Overdue
            </span>
            <div className="space-y-1.5">
              {overdue.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onToggleDone={handleToggleDone}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )}

        {/* Today section */}
        {hasTodayActivities && (
          <div
            className={`space-y-1.5 ${
              !hasOverdue ? "mt-3 md:mt-5" : ""
            }`}
          >
            {hasOverdue && (
              <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Today
              </span>
            )}
            {todayActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onToggleDone={handleToggleDone}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
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

export default DayPage;
