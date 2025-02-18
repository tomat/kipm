function getMiddleArcPos(center_x, center_y, radius, angle_start, angle_end) {
  const middle_angle = (angle_start + angle_end) / 2;
  const middle_x = center_x + radius * Math.cos(middle_angle);
  const middle_y = center_y + radius * Math.sin(middle_angle);
  return { middle_x, middle_y };
}

module.exports = { getMiddleArcPos };