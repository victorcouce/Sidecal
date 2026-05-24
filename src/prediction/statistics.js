(function () {
  if (!window.SCAL) window.SCAL = {};

  function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  function median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  function standardDeviation(arr) {
    if (!arr || arr.length < 2) return 0;
    const avg = mean(arr);
    const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
    const avgSquareDiff = mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  function coefficientOfVariation(arr) {
    if (!arr || arr.length === 0) return 0;
    const avg = mean(arr);
    if (avg === 0) return 0;
    const stdDev = standardDeviation(arr);
    return stdDev / avg;
  }

  function computeIntervals(videos) {
    if (!videos || videos.length < 2) return [];

    const intervals = [];
    for (let i = 1; i < videos.length; i++) {
      const curr = new Date(videos[i].published);
      const prev = new Date(videos[i - 1].published);
      const daysDiff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }

    return intervals;
  }

  function collapseBursts(videos, thresholdHours = 4) {
    if (!videos || videos.length === 0) return [];

    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    const result = [];
    let currentBurst = null;

    for (const video of videos) {
      const videoTime = new Date(video.published).getTime();

      if (!currentBurst) {
        currentBurst = { ...video, burstEnd: videoTime };
        continue;
      }

      const timeSinceLastBurst = videoTime - new Date(currentBurst.published).getTime();

      if (timeSinceLastBurst < thresholdMs) {
        // Part of the same burst
        currentBurst.burstEnd = videoTime;
      } else {
        // Burst ended, save it
        result.push(currentBurst);
        currentBurst = { ...video, burstEnd: videoTime };
      }
    }

    if (currentBurst) {
      result.push(currentBurst);
    }

    return result;
  }

  window.SCAL.statistics = {
    mean,
    median,
    standardDeviation,
    coefficientOfVariation,
    computeIntervals,
    collapseBursts,
  };
})();
