import React, { useState } from 'react';
import ReactApexChart from 'react-apexcharts';

const ApexChart = ({registerPerDay}) => {
    let day=[];
    let count=[];
    registerPerDay.forEach((item)=>{
        day.push(item.day);
        count.push(item.count);
    })

  const [chartData, setChartData] = useState({
    series: [{
      data: count
    }],
    options: {
      chart: {
        type: 'bar',
        height: 350
      },
      plotOptions: {
        bar: {
          barHeight: '100%',
          distributed: true,
          horizontal: true,
          dataLabels: {
            position: 'bottom'
          },
        }
      },
      colors: ['#33b2df', '#546E7A', '#d4526e', '#13d8aa', '#A5978B', '#2b908f', '#f9a3a4'],
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        style: {
          colors: ['#fff'],
          fontSize: '12px',
        },
        formatter: function (val, opt) {
          return opt.w.globals.labels[opt.dataPointIndex] + ":  " + val
        },
        offsetX: 0,
        dropShadow: {
          enabled: true
        }
      },
      stroke: {
        width: 1,
        colors: ['#fff']
      },
      xaxis: {
        categories: day,
      },
      yaxis: {
        labels: {
          show: false
        }
      },
    //   title: {
    //     text: 'Custom DataLabels',
    //     align: 'center',
    //     floating: true
    //   },
    //   subtitle: {
    //     text: 'Category Names as DataLabels inside bars',
    //     align: 'center',
    //   },
      tooltip: {
        theme: 'dark',
        x: {
          show: false
        },
        y: {
          title: {
            formatter: function () {
              return 'Number of Registrations'
            }
          }
        }
      }
    },
  });

  return (
    <div id="chart" className='ChartContainer'>
      <ReactApexChart options={chartData.options} series={chartData.series} type="bar" height={450} 
      width={500}
      />
      <h2>Número de registros por día</h2>
    </div>
  );
};

export default ApexChart;
