"""
Export Service

This module provides functionality to export routes to different formats:
- CSV: Simple spreadsheet format for easy sharing
- PDF: Professional report format with route details

These exports are useful for:
- Sharing routes with drivers who don't have app access
- Archiving completed routes
- Reporting to management
"""

import csv
import io
from typing import Dict, Any
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import logging

logger = logging.getLogger(__name__)


class ExportService:
    """
    Route Export Service
    
    Provides methods to export route data to various formats.
    """
    
    def __init__(self):
        """Initialize Export Service"""
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
    
    def _create_custom_styles(self):
        """
        Create Custom PDF Styles
        
        Defines styling for different PDF elements.
        """
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='CustomSubtitle',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#3b82f6'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))
        
        # Info style
        self.styles.add(ParagraphStyle(
            name='InfoText',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#374151'),
            spaceAfter=6
        ))
    
    def export_route_to_csv(self, route: Dict[str, Any]) -> bytes:
        """
        Export Route to CSV
        
        Creates a CSV file with route and delivery information.
        The CSV includes:
        - Route header information
        - Delivery points in optimized sequence
        - Distance and duration for each segment
        
        Args:
            route: Route dictionary from database
            
        Returns:
            bytes: CSV file content as bytes
            
        Example:
            csv_data = export_service.export_route_to_csv(route)
            # Save or send csv_data
        """
        logger.info(f"Exporting route {route.get('route_id')} to CSV")
        
        # Create in-memory text stream
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write route header information
        writer.writerow(['RouteChain - Delivery Route Export'])
        writer.writerow([])  # Empty row
        writer.writerow(['Route ID:', route.get('route_id')])
        writer.writerow(['Route Name:', route.get('route_name')])
        writer.writerow(['Driver ID:', route.get('driver_id')])
        writer.writerow(['Status:', route.get('status')])
        writer.writerow(['Created:', route.get('created_at', '').strftime('%Y-%m-%d %H:%M') if route.get('created_at') else 'N/A'])
        
        # Add optimization statistics
        opt_result = route.get('optimization_result', {})
        if opt_result:
            writer.writerow([])
            writer.writerow(['Total Distance (km):', opt_result.get('total_distance_km', 'N/A')])
            writer.writerow(['Total Duration (min):', opt_result.get('total_duration_minutes', 'N/A')])
        
        # Add depot information
        writer.writerow([])
        writer.writerow(['DEPOT INFORMATION'])
        depot_address = route.get('depot_address', {})
        depot_location = route.get('depot_location', {})
        if depot_address:
            writer.writerow(['Address:', depot_address.get('full_address', 'N/A')])
        if depot_location:
            writer.writerow(['Coordinates:', f"{depot_location.get('latitude')}, {depot_location.get('longitude')}"])
        
        # Write delivery points header
        writer.writerow([])
        writer.writerow(['DELIVERY SEQUENCE'])
        writer.writerow([
            'Sequence',
            'Point ID',
            'Customer Name',
            'Address',
            'City',
            'Phone',
            'Packages',
            'Status',
            'Time Window',
            'Instructions',
            'Latitude',
            'Longitude'
        ])
        
        # Write each delivery point
        delivery_points = route.get('delivery_points', [])
        for i, point in enumerate(delivery_points, start=1):
            address = point.get('address', {})
            location = point.get('location', {})
            
            time_window = ''
            if point.get('time_window_start') and point.get('time_window_end'):
                time_window = f"{point.get('time_window_start')} - {point.get('time_window_end')}"
            
            writer.writerow([
                i,
                point.get('point_id', ''),
                point.get('customer_name', ''),
                address.get('street', ''),
                address.get('city', ''),
                point.get('phone', ''),
                point.get('package_count', 1),
                point.get('status', 'pending'),
                time_window,
                point.get('instructions', ''),
                location.get('latitude', ''),
                location.get('longitude', '')
            ])
        
        # Write route segments (distances between points)
        route_segments = opt_result.get('route_segments', [])
        if route_segments:
            writer.writerow([])
            writer.writerow(['ROUTE SEGMENTS'])
            writer.writerow(['From', 'To', 'Distance (km)', 'Duration (min)'])
            
            for segment in route_segments:
                writer.writerow([
                    segment.get('from_point_id', ''),
                    segment.get('to_point_id', ''),
                    round(segment.get('distance_meters', 0) / 1000, 2),
                    round(segment.get('duration_minutes', 0), 1)
                ])
        
        # Get CSV content as bytes
        csv_content = output.getvalue()
        output.close()
        
        logger.info(f"✓ CSV export complete for route {route.get('route_id')}")
        
        return csv_content.encode('utf-8')
    
    def export_route_to_pdf(self, route: Dict[str, Any]) -> bytes:
        """
        Export Route to PDF
        
        Creates a professional PDF report with route information.
        The PDF includes:
        - Route header with logo/branding
        - Route summary statistics
        - Depot information
        - Delivery points table
        - Route segments table
        
        Args:
            route: Route dictionary from database
            
        Returns:
            bytes: PDF file content as bytes
        """
        logger.info(f"Exporting route {route.get('route_id')} to PDF")
        
        # Create in-memory byte stream
        buffer = io.BytesIO()
        
        # Create PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )
        
        # Container for PDF elements
        elements = []
        
        # Title
        title = Paragraph(
            "RouteChain - Delivery Route",
            self.styles['CustomTitle']
        )
        elements.append(title)
        elements.append(Spacer(1, 0.2*inch))
        
        # Route Information Section
        elements.append(Paragraph("Route Information", self.styles['CustomSubtitle']))
        
        route_info = [
            ['Route ID:', route.get('route_id', 'N/A')],
            ['Route Name:', route.get('route_name', 'N/A')],
            ['Driver ID:', route.get('driver_id', 'N/A')],
            ['Status:', route.get('status', 'N/A').upper()],
            ['Created:', route.get('created_at', '').strftime('%Y-%m-%d %H:%M') if route.get('created_at') else 'N/A'],
        ]
        
        # Add completion date if completed
        if route.get('completed_at'):
            route_info.append(['Completed:', route['completed_at'].strftime('%Y-%m-%d %H:%M')])
        
        route_info_table = Table(route_info, colWidths=[2*inch, 4*inch])
        route_info_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1f2937')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(route_info_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Optimization Statistics
        opt_result = route.get('optimization_result', {})
        if opt_result:
            elements.append(Paragraph("Route Statistics", self.styles['CustomSubtitle']))
            
            stats_data = [
                ['Total Distance:', f"{opt_result.get('total_distance_km', 'N/A')} km"],
                ['Total Duration:', f"{opt_result.get('total_duration_minutes', 'N/A')} minutes"],
                ['Number of Deliveries:', str(len(route.get('delivery_points', [])))]
            ]
            
            stats_table = Table(stats_data, colWidths=[2*inch, 2*inch])
            stats_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
                ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#374151')),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            
            elements.append(stats_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Depot Information
        elements.append(Paragraph("Depot Information", self.styles['CustomSubtitle']))
        
        depot_address = route.get('depot_address', {})
        depot_location = route.get('depot_location', {})
        
        depot_info = []
        if depot_address:
            depot_info.append(['Address:', depot_address.get('full_address', 'N/A')])
        if depot_location:
            depot_info.append([
                'Coordinates:',
                f"{depot_location.get('latitude', 'N/A')}, {depot_location.get('longitude', 'N/A')}"
            ])
        
        if depot_info:
            depot_table = Table(depot_info, colWidths=[2*inch, 4*inch])
            depot_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
                ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#374151')),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(depot_table)
        
        elements.append(Spacer(1, 0.3*inch))
        
        # Delivery Points Table
        elements.append(Paragraph("Delivery Sequence", self.styles['CustomSubtitle']))
        
        # Prepare delivery points data
        delivery_data = [['#', 'Customer', 'Address', 'City', 'Phone', 'Pkgs', 'Status']]
        
        delivery_points = route.get('delivery_points', [])
        for i, point in enumerate(delivery_points, start=1):
            address = point.get('address', {})
            delivery_data.append([
                str(i),
                point.get('customer_name', 'N/A'),
                address.get('street', 'N/A')[:30],  # Truncate long addresses
                address.get('city', 'N/A'),
                point.get('phone', 'N/A')[:15],
                str(point.get('package_count', 1)),
                point.get('status', 'pending')[:8]
            ])
        
        delivery_table = Table(
            delivery_data,
            colWidths=[0.3*inch, 1.5*inch, 2*inch, 1*inch, 1.2*inch, 0.4*inch, 0.8*inch]
        )
        
        delivery_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Data rows
            ('FONT', (0, 1), (-1, -1), 'Helvetica', 8),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1f2937')),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # Sequence number centered
            ('ALIGN', (5, 1), (5, -1), 'CENTER'),  # Package count centered
            ('ALIGN', (6, 1), (6, -1), 'CENTER'),  # Status centered
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
            
            # Padding
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        elements.append(delivery_table)
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF content
        pdf_content = buffer.getvalue()
        buffer.close()
        
        logger.info(f"✓ PDF export complete for route {route.get('route_id')}")
        
        return pdf_content


# Create a global instance
export_service = ExportService()