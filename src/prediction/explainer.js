(function () {
  if (!window.SCAL) window.SCAL = {};

  function formatInterval(days) {
    if (days < 1) return 'less than daily';
    if (days < 2) return 'roughly daily';
    if (days < 4) return `every ${Math.round(days)} days`;
    if (days < 8) return 'about once a week';
    if (days < 15) return 'every 1-2 weeks';
    if (days < 30) return 'about every 3 weeks';
    return `about every ${Math.round(days / 7)} weeks`;
  }

  function formatDays(dayOfWeekPattern) {
    if (!dayOfWeekPattern.hasPreference || dayOfWeekPattern.preferredDays.length === 0) {
      return 'no specific day';
    }

    if (dayOfWeekPattern.preferredDays.length === 1) {
      return `${dayOfWeekPattern.preferredDays[0]}s`;
    }

    return dayOfWeekPattern.preferredDays.slice(0, -1).join(', ') + ` and ${dayOfWeekPattern.preferredDays[dayOfWeekPattern.preferredDays.length - 1]}`;
  }

  function generateExplanation(analysis) {
    const {
      videoCount,
      medianInterval,
      meanInterval,
      cv,
      dayOfWeekPattern,
      hiatus,
      confidence,
    } = analysis;

    let explanation = '';

    // Main statement
    const cadence = formatInterval(medianInterval);
    explanation += `Based on ${videoCount} videos`;

    if (videoCount < 6) {
      explanation += ` (limited data)`;
    } else if (videoCount >= 12) {
      explanation += ` over an extended period`;
    }

    explanation += `, this creator typically uploads ${cadence}`;

    // Day preference
    if (dayOfWeekPattern.hasPreference) {
      explanation += `, usually on ${formatDays(dayOfWeekPattern)}`;
    }

    explanation += '.';

    // Regularity assessment
    if (cv <= 0.2) {
      explanation += ' Their schedule is very consistent.';
    } else if (cv <= 0.4) {
      explanation += ' Their schedule is fairly consistent.';
    } else if (cv <= 0.7) {
      explanation += ' Their schedule is somewhat irregular.';
    } else {
      explanation += ' Their schedule is quite variable.';
    }

    // Hiatus warning
    if (hiatus.label === 'likely_inactive') {
      explanation += ` Warning: This creator hasn't uploaded in ${hiatus.daysSinceLastUpload} days (${Math.round(hiatus.daysSinceLastUpload / medianInterval)}x their typical interval). They may be inactive.`;
    } else if (hiatus.label === 'possible_hiatus') {
      explanation += ` Note: They haven't uploaded in ${hiatus.daysSinceLastUpload} days, longer than their typical ${Math.round(medianInterval)}-day interval.`;
    } else if (hiatus.label === 'overdue') {
      explanation += ` They're slightly overdue (${hiatus.daysSinceLastUpload} days vs typical ${Math.round(medianInterval)}).`;
    }

    return explanation;
  }

  window.SCAL.explainer = {
    generateExplanation,
    formatInterval,
  };
})();
