(function () {
  if (!window.SCAL) window.SCAL = {};

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function detectDayOfWeekPreference(videos) {
    if (!videos || videos.length < 4) {
      return {
        preferredDays: [],
        concentration: 0,
        hasPreference: false,
        dayCounts: {},
      };
    }

    const dayCounts = {};
    DAY_NAMES.forEach(day => {
      dayCounts[day] = 0;
    });

    videos.forEach(video => {
      const date = new Date(video.published);
      const dayIndex = date.getDay();
      const dayName = DAY_NAMES[dayIndex];
      dayCounts[dayName]++;
    });

    const totalVideos = videos.length;
    const uniformExpectation = totalVideos / 7;
    const preferredDays = [];
    let maxCount = 0;

    // Find days with >2.5x the uniform distribution
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count > maxCount) maxCount = count;
      if (count >= uniformExpectation * 2.5 && count >= 2) {
        preferredDays.push(day);
      }
    }

    // Calculate concentration (how many videos on preferred days / total)
    const videosOnPreferredDays = preferredDays.reduce((sum, day) => sum + dayCounts[day], 0);
    const concentration = totalVideos > 0 ? videosOnPreferredDays / totalVideos : 0;

    // Must have concentration >= 0.4 (40%) to be considered a real preference
    const hasPreference = preferredDays.length > 0 && concentration >= 0.4;

    return {
      preferredDays: hasPreference ? preferredDays : [],
      concentration,
      hasPreference,
      dayCounts,
    };
  }

  function detectHiatus(videos, medianIntervalDays) {
    if (!videos || videos.length === 0) {
      return {
        label: 'no_data',
        daysSinceLastUpload: null,
      };
    }

    const lastVideo = videos[videos.length - 1];
    const lastUploadDate = new Date(lastVideo.published);
    const now = new Date();
    const daysSinceLastUpload = (now.getTime() - lastUploadDate.getTime()) / (1000 * 60 * 60 * 24);

    let label = 'normal';
    if (daysSinceLastUpload > medianIntervalDays * 4) {
      label = 'likely_inactive';
    } else if (daysSinceLastUpload > medianIntervalDays * 2) {
      label = 'possible_hiatus';
    } else if (daysSinceLastUpload > medianIntervalDays * 1.5) {
      label = 'overdue';
    }

    return {
      label,
      daysSinceLastUpload: Math.round(daysSinceLastUpload),
    };
  }

  function snapToPreferredDay(date, preferredDays) {
    if (!preferredDays || preferredDays.length === 0) {
      return date;
    }

    const targetDayIndex = DAY_NAMES.indexOf(preferredDays[0]);
    if (targetDayIndex === -1) return date;

    let snappedDate = new Date(date);
    const currentDayIndex = snappedDate.getDay();
    let daysToAdd = 0;

    // Calculate days to add to reach the preferred day
    if (currentDayIndex <= targetDayIndex) {
      daysToAdd = targetDayIndex - currentDayIndex;
    } else {
      daysToAdd = 7 - currentDayIndex + targetDayIndex;
    }

    // Only snap if within ±3 days
    if (daysToAdd > 3 && daysToAdd < 7 - 3) {
      return date; // Don't snap if too far
    }

    if (daysToAdd <= 3) {
      snappedDate.setDate(snappedDate.getDate() + daysToAdd);
    } else if (daysToAdd > 3) {
      // Snap backwards instead
      snappedDate.setDate(snappedDate.getDate() + daysToAdd - 7);
    }

    return snappedDate;
  }

  window.SCAL.patterns = {
    detectDayOfWeekPreference,
    detectHiatus,
    snapToPreferredDay,
  };
})();
