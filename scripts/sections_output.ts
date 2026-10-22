const circuitSections: TrackSectionConfig[] = [
  // 1. Start/Finish at (0, 0)
  { file: 'track-finish.glb', position: new Vector3(0, 0, 0), rotationY: 0 },
  // 2. Straight at (0, 10)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 10), rotationY: 0 },
  // 3. Straight at (0, 20)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 20), rotationY: 0 },
  // 4. Straight at (0, 30)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 30), rotationY: 0 },
  // 5. Straight at (0, 40)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 40), rotationY: 0 },
  // 6. Straight at (0, 50)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 50), rotationY: 0 },
  // 7. Straight at (0, 60)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 60), rotationY: 0 },
  // 8. Straight at (0, 70)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 70), rotationY: 0 },
  // 9. Straight at (0, 80)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 80), rotationY: 0 },
  // 10. Straight at (0, 90)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 90), rotationY: 0 },
  // 11. Straight at (0, 100)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 100), rotationY: 0 },
  // 12. Corner at (0, 110)
  { file: 'track-corner.glb', position: new Vector3(0, 0, 110), rotationY: Math.PI / 2 },
  // 13. Straight at (10, 110)
  { file: 'track-straight.glb', position: new Vector3(10, 0, 110), rotationY: Math.PI / 2 },
  // 14. Straight at (20, 110)
  { file: 'track-straight.glb', position: new Vector3(20, 0, 110), rotationY: Math.PI / 2 },
  // 15. Straight at (30, 110)
  { file: 'track-straight.glb', position: new Vector3(30, 0, 110), rotationY: Math.PI / 2 },
  // 16. Corner at (40, 110)
  { file: 'track-corner.glb', position: new Vector3(40, 0, 110), rotationY: Math.PI },
  // 17. Straight at (40, 100)
  { file: 'track-straight.glb', position: new Vector3(40, 0, 100), rotationY: 0 },
  // 18. Straight at (40, 90)
  { file: 'track-straight.glb', position: new Vector3(40, 0, 90), rotationY: 0 },
  // 19. Straight at (40, 80)
  { file: 'track-straight.glb', position: new Vector3(40, 0, 80), rotationY: 0 },
  // 20. Corner at (40, 70)
  { file: 'track-corner.glb', position: new Vector3(40, 0, 70), rotationY: 0 },
  // 21. Straight at (50, 70)
  { file: 'track-straight.glb', position: new Vector3(50, 0, 70), rotationY: Math.PI / 2 },
  // 22. Straight at (60, 70)
  { file: 'track-straight.glb', position: new Vector3(60, 0, 70), rotationY: Math.PI / 2 },
  // 23. Straight at (70, 70)
  { file: 'track-straight.glb', position: new Vector3(70, 0, 70), rotationY: Math.PI / 2 },
  // 24. Corner at (80, 70)
  { file: 'track-corner.glb', position: new Vector3(80, 0, 70), rotationY: Math.PI },
  // 25. Straight at (80, 60)
  { file: 'track-straight.glb', position: new Vector3(80, 0, 60), rotationY: 0 },
  // 26. Straight at (80, 50)
  { file: 'track-straight.glb', position: new Vector3(80, 0, 50), rotationY: 0 },
  // 27. Straight at (80, 40)
  { file: 'track-straight.glb', position: new Vector3(80, 0, 40), rotationY: 0 },
  // 28. Straight at (80, 30)
  { file: 'track-straight.glb', position: new Vector3(80, 0, 30), rotationY: 0 },
  // 29. Corner at (80, 20)
  { file: 'track-corner.glb', position: new Vector3(80, 0, 20), rotationY: (3 * Math.PI) / 2 },
  // 30. Straight at (70, 20)
  { file: 'track-straight.glb', position: new Vector3(70, 0, 20), rotationY: Math.PI / 2 },
  // 31. Straight at (60, 20)
  { file: 'track-straight.glb', position: new Vector3(60, 0, 20), rotationY: Math.PI / 2 },
  // 32. Corner at (50, 20)
  { file: 'track-corner.glb', position: new Vector3(50, 0, 20), rotationY: Math.PI / 2 },
  // 33. Straight at (50, 10)
  { file: 'track-straight.glb', position: new Vector3(50, 0, 10), rotationY: 0 },
  // 34. Straight at (50, 0)
  { file: 'track-straight.glb', position: new Vector3(50, 0, 0), rotationY: 0 },
  // 35. Corner at (50, -10)
  { file: 'track-corner.glb', position: new Vector3(50, 0, -10), rotationY: 0 },
  // 36. Straight at (60, -10)
  { file: 'track-straight.glb', position: new Vector3(60, 0, -10), rotationY: Math.PI / 2 },
  // 37. Straight at (70, -10)
  { file: 'track-straight.glb', position: new Vector3(70, 0, -10), rotationY: Math.PI / 2 },
  // 38. Straight at (80, -10)
  { file: 'track-straight.glb', position: new Vector3(80, 0, -10), rotationY: Math.PI / 2 },
  // 39. Straight at (90, -10)
  { file: 'track-straight.glb', position: new Vector3(90, 0, -10), rotationY: Math.PI / 2 },
  // 40. Straight at (100, -10)
  { file: 'track-straight.glb', position: new Vector3(100, 0, -10), rotationY: Math.PI / 2 },
  // 41. Straight at (110, -10)
  { file: 'track-straight.glb', position: new Vector3(110, 0, -10), rotationY: Math.PI / 2 },
  // 42. Corner at (120, -10)
  { file: 'track-corner.glb', position: new Vector3(120, 0, -10), rotationY: Math.PI },
  // 43. Straight at (120, -20)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -20), rotationY: 0 },
  // 44. Straight at (120, -30)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -30), rotationY: 0 },
  // 45. Straight at (120, -40)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -40), rotationY: 0 },
  // 46. Straight at (120, -50)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -50), rotationY: 0 },
  // 47. Straight at (120, -60)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -60), rotationY: 0 },
  // 48. Straight at (120, -70)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -70), rotationY: 0 },
  // 49. Straight at (120, -80)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -80), rotationY: 0 },
  // 50. Straight at (120, -90)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -90), rotationY: 0 },
  // 51. Straight at (120, -100)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -100), rotationY: 0 },
  // 52. Straight at (120, -110)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -110), rotationY: 0 },
  // 53. Straight at (120, -120)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -120), rotationY: 0 },
  // 54. Straight at (120, -130)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -130), rotationY: 0 },
  // 55. Straight at (120, -140)
  { file: 'track-straight.glb', position: new Vector3(120, 0, -140), rotationY: 0 },
  // 56. Corner at (120, -150)
  { file: 'track-corner.glb', position: new Vector3(120, 0, -150), rotationY: (3 * Math.PI) / 2 },
  // 57. Straight at (110, -150)
  { file: 'track-straight.glb', position: new Vector3(110, 0, -150), rotationY: Math.PI / 2 },
  // 58. Straight at (100, -150)
  { file: 'track-straight.glb', position: new Vector3(100, 0, -150), rotationY: Math.PI / 2 },
  // 59. Straight at (90, -150)
  { file: 'track-straight.glb', position: new Vector3(90, 0, -150), rotationY: Math.PI / 2 },
  // 60. Straight at (80, -150)
  { file: 'track-straight.glb', position: new Vector3(80, 0, -150), rotationY: Math.PI / 2 },
  // 61. Corner at (70, -150)
  { file: 'track-corner.glb', position: new Vector3(70, 0, -150), rotationY: 0 },
  // 62. Straight at (70, -140)
  { file: 'track-straight.glb', position: new Vector3(70, 0, -140), rotationY: 0 },
  // 63. Straight at (70, -130)
  { file: 'track-straight.glb', position: new Vector3(70, 0, -130), rotationY: 0 },
  // 64. Straight at (70, -120)
  { file: 'track-straight.glb', position: new Vector3(70, 0, -120), rotationY: 0 },
  // 65. Corner at (70, -110)
  { file: 'track-corner.glb', position: new Vector3(70, 0, -110), rotationY: Math.PI },
  // 66. Straight at (60, -110)
  { file: 'track-straight.glb', position: new Vector3(60, 0, -110), rotationY: Math.PI / 2 },
  // 67. Straight at (50, -110)
  { file: 'track-straight.glb', position: new Vector3(50, 0, -110), rotationY: Math.PI / 2 },
  // 68. Straight at (40, -110)
  { file: 'track-straight.glb', position: new Vector3(40, 0, -110), rotationY: Math.PI / 2 },
  // 69. Straight at (30, -110)
  { file: 'track-straight.glb', position: new Vector3(30, 0, -110), rotationY: Math.PI / 2 },
  // 70. Straight at (20, -110)
  { file: 'track-straight.glb', position: new Vector3(20, 0, -110), rotationY: Math.PI / 2 },
  // 71. Corner at (10, -110)
  { file: 'track-corner.glb', position: new Vector3(10, 0, -110), rotationY: Math.PI / 2 },
  // 72. Straight at (10, -120)
  { file: 'track-straight.glb', position: new Vector3(10, 0, -120), rotationY: 0 },
  // 73. Straight at (10, -130)
  { file: 'track-straight.glb', position: new Vector3(10, 0, -130), rotationY: 0 },
  // 74. Straight at (10, -140)
  { file: 'track-straight.glb', position: new Vector3(10, 0, -140), rotationY: 0 },
  // 75. Corner at (10, -150)
  { file: 'track-corner.glb', position: new Vector3(10, 0, -150), rotationY: (3 * Math.PI) / 2 },
  // 76. Straight at (0, -150)
  { file: 'track-straight.glb', position: new Vector3(0, 0, -150), rotationY: Math.PI / 2 },
  // 77. Straight at (-10, -150)
  { file: 'track-straight.glb', position: new Vector3(-10, 0, -150), rotationY: Math.PI / 2 },
  // 78. Straight at (-20, -150)
  { file: 'track-straight.glb', position: new Vector3(-20, 0, -150), rotationY: Math.PI / 2 },
  // 79. Straight at (-30, -150)
  { file: 'track-straight.glb', position: new Vector3(-30, 0, -150), rotationY: Math.PI / 2 },
  // 80. Corner at (-40, -150)
  { file: 'track-corner.glb', position: new Vector3(-40, 0, -150), rotationY: 0 },
  // 81. Straight at (-40, -140)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -140), rotationY: 0 },
  // 82. Straight at (-40, -130)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -130), rotationY: 0 },
  // 83. Straight at (-40, -120)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -120), rotationY: 0 },
  // 84. Straight at (-40, -110)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -110), rotationY: 0 },
  // 85. Straight at (-40, -100)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -100), rotationY: 0 },
  // 86. Straight at (-40, -90)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -90), rotationY: 0 },
  // 87. Straight at (-40, -80)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -80), rotationY: 0 },
  // 88. Straight at (-40, -70)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -70), rotationY: 0 },
  // 89. Straight at (-40, -60)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -60), rotationY: 0 },
  // 90. Straight at (-40, -50)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -50), rotationY: 0 },
  // 91. Straight at (-40, -40)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -40), rotationY: 0 },
  // 92. Straight at (-40, -30)
  { file: 'track-straight.glb', position: new Vector3(-40, 0, -30), rotationY: 0 },
  // 93. Corner at (-40, -20)
  { file: 'track-corner.glb', position: new Vector3(-40, 0, -20), rotationY: Math.PI / 2 },
  // 94. Straight at (-30, -20)
  { file: 'track-straight.glb', position: new Vector3(-30, 0, -20), rotationY: Math.PI / 2 },
  // 95. Straight at (-20, -20)
  { file: 'track-straight.glb', position: new Vector3(-20, 0, -20), rotationY: Math.PI / 2 },
  // 96. Straight at (-10, -20)
  { file: 'track-straight.glb', position: new Vector3(-10, 0, -20), rotationY: Math.PI / 2 },
  // 97. Corner at (0, -20)
  { file: 'track-corner.glb', position: new Vector3(0, 0, -20), rotationY: (3 * Math.PI) / 2 },
  // 98. Straight at (0, -10)
  { file: 'track-straight.glb', position: new Vector3(0, 0, -10), rotationY: 0 },
];
