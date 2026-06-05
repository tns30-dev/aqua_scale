# Speaker Note - App Demonstration

## Opening

Today I will demonstrate AquaShield, an aquaculture decision-support platform. The purpose of the platform is to help farmers, researchers, product developers, and business owners monitor pond conditions, compare pond performance, track treatment effectiveness, and make decisions based on reliable water-quality data.

The platform is designed around real aquaculture operations. A farm can have multiple projects, profiles, ponds, cycles, sensors, alerts, and reports. Instead of only showing raw sensor readings, AquaShield organizes the data into a platform view that supports monitoring, operational response, and business evidence.

## Login and Project Context

I will start from the login flow. After login, the system loads the authenticated user session and the projects that this user is allowed to access.

This is important because AquaShield is not a single-user dashboard. Different users may represent farmers, researchers, product developers, administrators, or business owners. The platform controls which project and feature each user can access.

## Overview Dashboard

The first page is the Overview page. This page gives a quick operational summary of the selected project.

Here, the user can see the total ponds, active alerts, general pond health, and the current pond status. The pond cards are designed for fast scanning, so a farm operator can quickly identify which ponds are healthy and which ponds need attention.

The readings are connected to the pond context, not treated as isolated sensor values. That means every value belongs to a project, pond, cycle, and sensor mapping.

## Realtime Monitoring and Alerts

Next, I will show the realtime behavior. AquaShield supports realtime updates through the WebSocket gateway. When new telemetry arrives, the frontend can update the pond reading and alert status without requiring the user to refresh the page.

The alert logic is based on water-quality thresholds. If a parameter moves outside the safe range, the system can create an alert and show it to the user. This is useful for farm managers because water-quality problems need early response, not only historical reporting.

## Digital Twin View

The Digital Twin page gives a more detailed pond-level view. The goal of this view is to represent the pond as a live operational object.

The user can inspect the current water-quality parameters, such as temperature, pH, dissolved oxygen, ammonia, or other configured measurements. This view helps the user understand the current pond condition instead of reading individual sensor records manually.

For the business case, this digital twin view is also important because it makes pond condition easier to explain to farmers, researchers, and product stakeholders.

## Historical Data

The Historical Data page shows how pond parameters change over time. This supports trend analysis, investigation, and reporting.

Instead of only knowing that a pond is currently safe or unsafe, the user can review the historical pattern. This helps answer questions such as whether water quality is improving, whether a treatment period changed the pond condition, or whether a parameter is repeatedly unstable.

## Pond Comparison

The Pond Comparison page supports comparison between two ponds. This is useful for aquaculture product evaluation.

For example, one pond may be used as a treatment pond and another as a comparison pond. The platform can compare water-quality metrics and show whether the treatment pond performs better or worse across selected parameters.

This feature connects directly to the business objective of AquaShield. If a company sells an aquaculture treatment product, the platform can help show evidence of whether the product improves pond condition, reduces risk, or supports operational efficiency.

## Energy Consumption

The Energy Consumption page adds an operational cost perspective. Aquaculture farms do not only care about water quality; they also care about energy usage, running cost, and operational efficiency.

By showing energy trends, high-consumption periods, and summary values, the platform supports a broader farm-management view. This helps connect water monitoring with practical business operation.

## User Management

For administrators, the platform includes user management. Admin users can manage users and assign access to projects.

This matters because the platform serves multiple stakeholder groups. A researcher may need access to treatment evidence, a farmer may need operational monitoring, and a business owner may need reports and comparison results. Access management keeps these responsibilities controlled.

## Closing

To summarize the application demonstration, AquaShield is not only a sensor dashboard. It is a platform for aquaculture monitoring, alerting, comparison, treatment evidence, reporting, and operational decision support.

The main value is that raw pond telemetry becomes organized business evidence. Farmers can respond to water-quality issues, researchers can evaluate treatment effectiveness, and business owners can use the platform to support product validation and customer-facing reporting.
