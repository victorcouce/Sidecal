(function () {
  if (!window.SCAL) window.SCAL = {};

  const { median, mean, coefficientOfVariation, computeIntervals, collapseBursts } = SCAL.statistics;
  const { detectDayOfWeekPreference, detectHiatus, snapToPreferredDay } = SCAL.patterns;

  function analyzeChannel(videos) {
    if (!videos || videos.length < 4) {
      return {
        confidence: {
          level: 'insufficient_data',
          rawScore: 0,
          factors: { sampleScore: 0, regularityScore: 0, recencyScore: 0, dowScore: 0 },
        },
        nextDates: [],
        stats: {
          videoCount: videos?.length || 0,
          medianIntervalDays: 0,
          meanIntervalDays: 0,
          cv: 0,
          preferredDays: [],
          typicalTimeUTC: null,
        },
        explanation: 'Not enough data to generate predictions.',
        hiatus: {
          label: 'insufficient_data',
          daysSinceLastUpload: null,
        },
      };
    }

    // Step 1: Collapse bursts
    const collapsedVideos = collapseBursts(videos, 4);

    // Step 2: Compute intervals
    const intervals = computeIntervals(collapsedVideos);
    if (intervals.length === 0) {
      return {
        confidence: {
          level: 'insufficient_data',
          rawScore: 0,
          factors: { sampleScore: 0, regularityScore: 0, recencyScore: 0, dowScore: 0 },
        },
        nextDates: [],
        stats: {
          videoCount: videos.length,
          medianIntervalDays: 0,
          meanIntervalDays: 0,
          cv: 0,
          preferredDays: [],
          typicalTimeUTC: null,
        },
        explanation: 'Not enough historical data.',
        hiatus: {
          label: 'no_data',
          daysSinceLastUpload: null,
        },
      };
    }

    // Step 3: Statistics
    const medianInterval = median(intervals);
    const meanInterval = mean(intervals);
    const cv = coefficientOfVariation(intervals);

    // Step 4: Detect day of week preference
    const dayOfWeekPattern = detectDayOfWeekPreference(videos);

    // Step 5: Detect hiatus
    const hiatus = detectHiatus(videos, medianInterval);

    // Step 6: Compute confidence
    const confidence = computeConfidence(videos, intervals, dayOfWeekPattern);

    // Step 7: Predict next uploads
    const nextDates = predictNextUploads(videos, medianInterval, dayOfWeekPattern);

    // Step 8: Generate explanation
    const explanation = SCAL.explainer.generateExplanation({
      videoCount: videos.length,
      medianInterval: medianInterval,
      meanInterval: meanInterval,
      cv: cv,
      dayOfWeekPattern: dayOfWeekPattern,
      hiatus: hiatus,
      confidence: confidence,
    });

    return {
      confidence,
      nextDates,
      stats: {
        videoCount: videos.length,
        medianIntervalDays: medianInterval,
        meanIntervalDays: meanInterval,
        cv: cv,
        preferredDays: dayOfWeekPattern.preferredDays,
        typicalTimeUTC: null, // MVP: not implemented
      },
      explanation,
      hiatus,
    };
  }

  function computeConfidence(videos, intervals, dayOfWeekPattern) {
    const sampleSize = videos.length;
    const cv = coefficientOfVariation(intervals);

    // Sample score: more videos = higher confidence
    let sampleScore = 0;
    if (sampleSize >= 12) sampleScore = 1.0;
    else if (sampleSize >= 8) sampleScore = 0.8;
    else if (sampleSize >= 6) sampleScore = 0.6;
    else if (sampleSize >= 4) sampleScore = 0.3;

    // Regularity score: lower CV = higher confidence
    let regularityScore = 0;
    if (cv <= 0.2) regularityScore = 1.0;
    else if (cv <= 0.35) regularityScore = 0.8;
    else if (cv <= 0.55) regularityScore = 0.6;
    else if (cv <= 0.8) regularityScore = 0.3;
    else regularityScore = 0.1;

    // Recency score: recent uploads = higher confidence
    const lastVideo = videos[videos.length - 1];
    const lastUploadDate = new Date(lastVideo.published);
    const daysSinceLastUpload = (new Date().getTime() - lastUploadDate.getTime()) / (1000 * 60 * 60 * 24);
    const medianInterval = median(intervals);
    let recencyScore = 0;
    if (daysSinceLastUpload <= medianInterval) recencyScore = 1.0;
    else if (daysSinceLastUpload <= medianInterval * 1.5) recencyScore = 0.8;
    else if (daysSinceLastUpload <= medianInterval * 2) recencyScore = 0.6;
    else if (daysSinceLastUpload <= medianInterval * 3) recencyScore = 0.3;
    else recencyScore = 0.1;

    // Day of week score
    let dowScore = 0;
    if (dayOfWeekPattern.hasPreference) {
      if (dayOfWeekPattern.concentration >= 0.6) dowScore = 1.0;
      else if (dayOfWeekPattern.concentration >= 0.5) dowScore = 0.8;
      else dowScore = 0.6;
    } else {
      dowScore = 0.3; // Slight penalty if no preference
    }

    // Weighted score: sample(25%) + regularity(35%) + recency(25%) + dow(15%)
    const rawScore = sampleScore * 0.25 + regularityScore * 0.35 + recencyScore * 0.25 + dowScore * 0.15;

    let level = 'low';
    if (rawScore >= 0.70) level = 'high';
    else if (rawScore >= 0.45) level = 'medium';

    return {
      level,
      rawScore: Math.round(rawScore * 100) / 100,
      factors: {
        sampleScore: Math.round(sampleScore * 100) / 100,
        regularityScore: Math.round(regularityScore * 100) / 100,
        recencyScore: Math.round(recencyScore * 100) / 100,
        dowScore: Math.round(dowScore * 100) / 100,
      },
    };
  }

  function predictNextUploads(videos, medianIntervalDays, dayOfWeekPattern, count = 3) {
    if (videos.length === 0) return [];

    const lastVideo = videos[videos.length - 1];
    const lastUploadDate = new Date(lastVideo.published);

    const predictions = [];
    let currentDate = new Date(lastUploadDate);

    for (let i = 0; i < count; i++) {
      currentDate = new Date(currentDate.getTime() + medianIntervalDays * 24 * 60 * 60 * 1000);

      // Snap to preferred day if available
      if (dayOfWeekPattern.hasPreference) {
        currentDate = snapToPreferredDay(currentDate, dayOfWeekPattern.preferredDays);
      }

      predictions.push({
        date: currentDate.toISOString(),
        hasTime: false, // MVP: no time detection
      });
    }

    return predictions;
  }

  window.SCAL.prediction = {
    analyzeChannel,
    computeConfidence,
    predictNextUploads,
  };
})();
