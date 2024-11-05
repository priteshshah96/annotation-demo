// src/components/dashboard/StatsPanel.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { 
  Box,
  Tooltip,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  useTheme 
} from '@mui/material';
import {
  TrendingUp,
  Description,
  FormatQuote,
  Science,
  CheckCircle
} from '@mui/icons-material';

const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  tooltip = '', 
  trend = null, 
  color = '#666666' 
}) => {
  const theme = useTheme();

  return (
    <Card 
      elevation={0}
      sx={{ 
        flexGrow: 1, 
        minWidth: { xs: '100%', sm: '200px' },
        backgroundColor: `${color}15`,
        border: 1,
        borderColor: `${color}30`,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[2],
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Tooltip title={tooltip} arrow placement="top">
            <Box>
              <Typography 
                variant="subtitle2" 
                color="text.secondary"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontWeight: 500
                }}
              >
                {title}
              </Typography>
            </Box>
          </Tooltip>
          <Icon sx={{ color: color, opacity: 0.8 }} />
        </Box>

        <Typography 
          variant="h4" 
          component="div" 
          sx={{ 
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 1
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>

        {trend !== null && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ flexGrow: 1 }}
              >
                Progress
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary"
              >
                {trend}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={trend} 
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: `${color}20`,
                '& .MuiLinearProgress-bar': {
                  bgcolor: color,
                }
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

StatsCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  icon: PropTypes.elementType.isRequired,
  tooltip: PropTypes.string,
  trend: PropTypes.number,
  color: PropTypes.string
};

const StatsPanel = ({ 
  stats, 
  loading = false 
}) => {
  const theme = useTheme();

  const statsConfig = [
    {
      title: 'Total Annotations',
      value: stats.totalAnnotations,
      icon: Description,
      tooltip: 'Total number of annotations made across all files',
      trend: (stats.totalAnnotations / stats.targetAnnotations) * 100,
      color: theme.palette.primary.main
    },
    {
      title: 'Completed Files',
      value: stats.completedFiles,
      icon: CheckCircle,
      tooltip: 'Number of files with all annotations completed',
      trend: stats.totalFiles > 0 ? (stats.completedFiles / stats.totalFiles) * 100 : 0,
      color: theme.palette.success.main
    },
    {
      title: 'Total Sentences',
      value: stats.totalSentences,
      icon: FormatQuote,
      tooltip: 'Total number of sentences across all files',
      color: theme.palette.info.main
    },
    {
      title: 'Scientific Entities',
      value: stats.totalEntities,
      icon: Science,
      tooltip: 'Total number of scientific entities identified',
      trend: (stats.annotatedEntities / stats.totalEntities) * 100,
      color: theme.palette.warning.main
    }
  ];

  return (
    <Box 
      sx={{ 
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          md: 'repeat(4, 1fr)'
        },
        gap: 2,
        mb: 4,
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      {statsConfig.map((stat) => (
        <StatsCard
          key={stat.title}
          {...stat}
          value={loading ? '-' : stat.value}
        />
      ))}
    </Box>
  );
};

StatsPanel.propTypes = {
  stats: PropTypes.shape({
    totalAnnotations: PropTypes.number.isRequired,
    completedFiles: PropTypes.number.isRequired,
    totalSentences: PropTypes.number.isRequired,
    totalEntities: PropTypes.number.isRequired,
    targetAnnotations: PropTypes.number.isRequired,
    totalFiles: PropTypes.number.isRequired,
    annotatedEntities: PropTypes.number.isRequired,
  }).isRequired,
  loading: PropTypes.bool
};

export default StatsPanel;