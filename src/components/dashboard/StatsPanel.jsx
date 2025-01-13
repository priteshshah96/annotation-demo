import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  FormatListBulleted as EventsIcon,
  Article as PaperIcon
} from '@mui/icons-material';

// Stats card component
const StatsCard = ({ title, value, icon: Icon, tooltip = '', color = 'primary.main' }) => {
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Icon sx={{ color, mr: 1 }} />
            <Typography variant="h6" component="div" color="text.secondary">
              {title}
            </Typography>
          </Box>
          
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        </CardContent>
      </Card>
    </Tooltip>
  );
};

const StatsPanel = ({ files = [], loading = false }) => {
  const theme = useTheme();

  // Calculate basic statistics
  const stats = files.reduce((acc, file) => {
    try {
      const papers = file.papers || [];
      const totalPapers = papers.length;
      const totalEvents = papers.reduce((sum, paper) => 
        sum + (paper.events?.length || 0), 0);

      return {
        papers: acc.papers + totalPapers,
        events: acc.events + totalEvents
      };
    } catch (error) {
      console.error('Error processing file stats:', error);
      return acc;
    }
  }, {
    papers: 0,
    events: 0
  });

  const statsConfig = [
    {
      title: 'Total Papers',
      value: stats.papers,
      icon: PaperIcon,
      tooltip: 'Total number of papers across all files',
      color: theme.palette.primary.main
    },
    {
      title: 'Total Events',
      value: stats.events,
      icon: EventsIcon,
      tooltip: 'Total number of events across all papers',
      color: theme.palette.info.main
    }
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr'
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

export default StatsPanel;